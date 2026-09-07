import { describe, expect, it } from "vitest";
import { executeAgentTool } from "../../../electron/ai-edition/agent-tools";
import { moveClip } from "../ai-edition/document/timeline";
import { createEmptyDocument, documentSchema } from "../ai-edition/schema";
import { computeCameraFullscreenProgress } from "../zoomMath/cameraFullscreenUtils";
import { addChyron, chyronMotion, replaceChyron, templateChyron } from "./chyrons";
import { tightenPauses } from "./pauses";
import { wrapText } from "./rasterize";
import { serializeSubtitles } from "./subtitles";

function fixture() {
	return documentSchema.parse({
		...createEmptyDocument({ title: "Sample", projectId: "test" }),
		assets: [
			{ id: "a", kind: "video", label: "Sample", originalPath: "sample.mp4", durationSec: 12 },
		],
		timeline: {
			clips: [
				{
					id: "c1",
					assetId: "a",
					origin: "user",
					sourceStartSec: 0,
					sourceEndSec: 6,
					timelineStartSec: 0,
					timelineEndSec: 6,
				},
				{
					id: "c2",
					assetId: "a",
					origin: "user",
					sourceStartSec: 6,
					sourceEndSec: 12,
					timelineStartSec: 6,
					timelineEndSec: 12,
				},
			],
		},
	});
}

describe("PL Studio authored graphics", () => {
	it("preserves semantic text and clip anchors through save, reopen, and reorder", () => {
		const original = fixture();
		const labeled = addChyron(original, templateChyron("presenter"), 1, 4);
		const reopened = documentSchema.parse(JSON.parse(JSON.stringify(labeled)));
		expect(reopened.annotations[0].chyron?.headline).toBe("Nick Pollack");
		expect(reopened.annotations[0].clipId).toBe("c1");
		const moved = moveClip(reopened, "c1", 1);
		expect(moved.annotations[0].sourceStartSec).toBe(1);
		expect(moved.annotations[0].startMs).toBe(7000);
		expect(original.annotations).toEqual([]);
	});
	it("retains content when replacing a style or template", () => {
		const doc = addChyron(fixture(), templateChyron("presenter"), 0);
		const edited = replaceChyron(doc, doc.annotations[0].id, {
			variant: "spotlight",
			template: "closing",
		});
		expect(edited.annotations[0].chyron?.headline).toBe("Nick Pollack");
		expect(edited.assets).toEqual(doc.assets);
	});
	it("refuses AI removal of locked chyrons", () => {
		const doc = addChyron(fixture(), { ...templateChyron("section"), locked: true }, 1);
		const result = executeAgentTool(
			doc,
			"removeModifier",
			JSON.stringify({ id: doc.annotations[0].id }),
		);
		expect(result.ok).toBe(false);
		expect(result.document).toBeUndefined();
	});
	it("evaluates the same motion when seeking backward", () => {
		const value = templateChyron("section");
		const before = chyronMotion(value, 110, 4000);
		chyronMotion(value, 3000, 4000);
		expect(chyronMotion(value, 110, 4000)).toEqual(before);
		expect(chyronMotion(value, 1500, 4000)).toEqual({ opacity: 1, x: 0, reveal: 1 });
		expect(chyronMotion(value, 4000, 4000).opacity).toBe(0);
	});
	it("wraps long names without losing letters", () => {
		const name = "VeryLongUnbrokenPlayerName";
		const lines = wrapText(name, 8, (s) => s.length);
		expect(lines.join("")).toBe(name);
		expect(lines.every((s) => s.length <= 8)).toBe(true);
	});
	it("starts a presenter intro full screen and reaches the corner at its authored end", () => {
		const regions = [
			{ id: "intro", startMs: 0, endMs: 4600, transitionMs: 600, startFullscreen: true },
		];
		expect(computeCameraFullscreenProgress(regions, 0)).toBe(1);
		expect(computeCameraFullscreenProgress(regions, 4000)).toBe(1);
		expect(computeCameraFullscreenProgress(regions, 4300)).toBeGreaterThan(0);
		expect(computeCameraFullscreenProgress(regions, 4600)).toBe(0);
	});
	it("exports subtitle text with standard time syntax", () => {
		const doc = fixture();
		doc.transcripts = [
			{
				assetId: "a",
				language: "en",
				words: [],
				segments: [
					{ id: "s", kind: "speech", startSec: 1, endSec: 3, text: "Pitcher List", wordIds: [] },
				],
			},
		];
		expect(serializeSubtitles(doc, "srt")).toContain(" --> ");
		expect(serializeSubtitles(doc, "vtt")).toMatch(/^WEBVTT\n/);
		expect(serializeSubtitles(doc, "srt")).toContain("Pitcher List");
	});
	it("keeps a chyron style when AI changes its text in the same command", () => {
		const doc = addChyron(fixture(), templateChyron("section"), 1);
		const result = executeAgentTool(
			doc,
			"setAnnotation",
			JSON.stringify({
				annotationId: doc.annotations[0].id,
				text: "Approved title",
				chyron: { variant: "soft-panel", padding: 40 },
			}),
		);
		expect(result.ok).toBe(true);
		expect(result.document?.annotations[0].chyron).toMatchObject({
			headline: "Approved title",
			variant: "soft-panel",
			padding: 40,
		});
	});
	it("tightens only explicit silence, preserves locks and does not repeat cuts", () => {
		const doc = fixture();
		doc.transcripts = [
			{
				assetId: "a",
				language: "en",
				words: [],
				segments: [
					{ id: "silent", kind: "silence", startSec: 1, endSec: 3, text: "", wordIds: [] },
					{
						id: "speech",
						kind: "speech",
						startSec: 4,
						endSec: 6,
						text: "Keep this explanation",
						wordIds: [],
					},
				],
			},
		];
		const cut = tightenPauses(doc);
		expect(cut.timeline.trimRanges).toHaveLength(1);
		expect(cut.timeline.trimRanges[0]).toMatchObject({ startSec: 1.25, endSec: 2.75 });
		expect(tightenPauses(cut).timeline.trimRanges).toHaveLength(1);
		const locked = addChyron(doc, { ...templateChyron("section"), locked: true }, 1);
		expect(tightenPauses(locked).timeline.trimRanges).toHaveLength(0);
		expect(cut.transcripts).toEqual(doc.transcripts);
	});
});

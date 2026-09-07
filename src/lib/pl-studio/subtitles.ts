import { deriveCaptionCues } from "../ai-edition/captions/cues";
import { getCaptionSettings } from "../ai-edition/captions/settings";
import { getCaptionTranslations } from "../ai-edition/captions/translations";
import type { AxcutDocument } from "../ai-edition/schema";
import { keptRawSpans } from "../ai-edition/timeline/programme-time";

export function subtitleCues(doc: AxcutDocument) {
	const cues = deriveCaptionCues(
		doc,
		{ ...getCaptionSettings(doc), enabled: true },
		getCaptionTranslations(doc),
	);
	const speeds = (doc.legacyEditor?.speedRegions ?? []) as {
		startMs: number;
		endMs: number;
		speed: number;
	}[];
	const spans = keptRawSpans(doc.timeline.clips, doc.timeline.trimRanges);
	const segments: { start: number; end: number; output: number; speed: number }[] = [];
	let output = 0;
	for (const span of spans) {
		const cuts = [
			...new Set([
				span.startSec,
				span.endSec,
				...speeds
					.flatMap((s) => [s.startMs / 1000, s.endMs / 1000])
					.filter((t) => t > span.startSec && t < span.endSec),
			]),
		].sort((a, b) => a - b);
		for (let i = 0; i < cuts.length - 1; i++) {
			const start = cuts[i],
				end = cuts[i + 1];
			const region = speeds.find((s) => start * 1000 >= s.startMs && start * 1000 < s.endMs);
			const speed = region && region.speed > 0 ? region.speed : 1;
			segments.push({ start, end, output, speed });
			output += (end - start) / speed;
		}
	}
	return cues
		.flatMap((cue) =>
			segments.flatMap((s) => {
				const start = Math.max(cue.startMs / 1000, s.start),
					end = Math.min(cue.endMs / 1000, s.end);
				return end > start
					? [
							{
								text: cue.text,
								start: s.output + (start - s.start) / s.speed,
								end: s.output + (end - s.start) / s.speed,
							},
						]
					: [];
			}),
		)
		.sort((a, b) => a.start - b.start);
}

export function serializeSubtitles(doc: AxcutDocument, format: "srt" | "vtt"): string {
	const timestamp = (sec: number) => {
		const ms = Math.round(sec * 1000);
		return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${format === "srt" ? "," : "."}${String(ms % 1000).padStart(3, "0")}`;
	};
	return (
		(format === "vtt" ? "WEBVTT\n\n" : "") +
		subtitleCues(doc)
			.map(
				(c, i) =>
					`${i + 1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text.replace(/-->/g, "→")}\n`,
			)
			.join("\n")
	);
}

import { describe, expect, it } from "vitest";
import { captureAreaSchema, cropCursorRecording, readAppliedCaptureArea } from "./captureArea";

describe("webpage capture area", () => {
	it("rejects out-of-window and invalid bounds", () => {
		for (const area of [
			{ x: -0.1, y: 0, width: 1, height: 1 },
			{ x: 0.5, y: 0, width: 0.6, height: 1 },
			{ x: 0, y: 0, width: 0, height: 1 },
			{ x: 0, y: NaN, width: 1, height: 1 },
		])
			expect(captureAreaSchema.safeParse(area).success).toBe(false);
	});
	it("maps the recorded cursor into the saved area and hides excluded points", () => {
		const result = cropCursorRecording(
			{
				version: 1,
				provider: "native",
				assets: [],
				samples: [
					{ timeMs: 0, cx: 0.5, cy: 0.6, interactionType: "click" },
					{ timeMs: 20, cx: 0.5, cy: 0.1 },
					{ timeMs: 40, cx: 0.5, cy: 0.6, visible: false },
				],
			},
			{ x: 0, y: 0.2, width: 1, height: 0.8 },
		);
		expect(result.samples[0].cy).toBeCloseTo(0.5);
		expect(result.samples[0]).toMatchObject({ visible: true, interactionType: "click" });
		expect(result.samples[1].visible).toBe(false);
		expect(result.samples[2].visible).toBe(false);
	});
	it("uses native rounded bounds rather than the preview approximation", () => {
		expect(
			readAppliedCaptureArea(
				'diagnostic\n{"event":"capture-area","area":{"x":0,"y":0.151,"width":1,"height":0.849}}',
			),
		).toEqual({ x: 0, y: 0.151, width: 1, height: 0.849 });
		expect(readAppliedCaptureArea("old helper")).toBeNull();
	});
});

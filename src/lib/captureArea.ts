import { z } from "zod";
import type { CursorRecordingData } from "../native/contracts";

export const captureAreaSchema = z
	.object({
		x: z.number().finite().min(0).max(1),
		y: z.number().finite().min(0).max(1),
		width: z.number().finite().positive().max(1),
		height: z.number().finite().positive().max(1),
	})
	.refine(
		(r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001,
		"The capture area must stay inside the window.",
	);
export type CaptureArea = z.infer<typeof captureAreaSchema>;

export function cropCursorRecording(
	data: CursorRecordingData,
	area: CaptureArea,
): CursorRecordingData {
	return {
		...data,
		samples: data.samples.map((sample) => {
			const cx = (sample.cx - area.x) / area.width;
			const cy = (sample.cy - area.y) / area.height;
			const visible = sample.visible !== false && cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1;
			return {
				...sample,
				cx: Math.max(0, Math.min(1, cx)),
				cy: Math.max(0, Math.min(1, cy)),
				visible,
				interactionType: visible ? sample.interactionType : ("move" as const),
			};
		}),
	};
}
export function readAppliedCaptureArea(output: string): CaptureArea | null {
	for (const line of output.split(/\r?\n/)) {
		try {
			const event = JSON.parse(line);
			if (event.event === "capture-area") return captureAreaSchema.parse(event.area);
		} catch {
			/* Non-JSON helper diagnostics. */
		}
	}
	return null;
}

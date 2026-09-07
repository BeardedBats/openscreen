import { z } from "zod";
import type { AxcutDocument } from "../ai-edition/schema";
import { studioFontStatus } from "./fonts";

export const feedbackSchema = z.object({
	version: z.literal(1).default(1),
	enabled: z.boolean().default(true),
	color: z
		.string()
		.regex(/^#[\da-fA-F]{6}$/)
		.default("#67dcf2"),
	opacity: z.number().min(0).max(1).default(0.65),
	size: z.number().min(24).max(160).default(64),
	durationMs: z.number().min(100).max(1500).default(350),
});
export function getClickFeedback(doc: AxcutDocument) {
	return feedbackSchema.parse(
		feedbackSchema.safeParse(doc.legacyEditor?.plClickFeedback).success
			? doc.legacyEditor?.plClickFeedback
			: { enabled: !!doc.legacyEditor?.plStudioVersion },
	);
}
const images = new Map<string, string>();
export function clickFeedbackScene(doc: AxcutDocument) {
	const value = getClickFeedback(doc);
	if (!value.enabled || !studioFontStatus.ready) return undefined;
	const key = JSON.stringify([value.color, value.opacity]);
	let image = images.get(key);
	if (!image) {
		const canvas = globalThis.document.createElement("canvas");
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;
		ctx.strokeStyle = value.color;
		ctx.globalAlpha = value.opacity;
		ctx.lineWidth = 10;
		ctx.beginPath();
		ctx.arc(128, 128, 114, 0, Math.PI * 2);
		ctx.stroke();
		image = canvas.toDataURL("image/png");
		if (images.size > 16) images.clear();
		images.set(key, image);
	}
	return { image, size: value.size, durationMs: value.durationMs };
}

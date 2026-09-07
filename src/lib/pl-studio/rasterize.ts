import type { AxcutAnnotationRegion } from "../ai-edition/schema";
import { studioFontStatus } from "./fonts";
import type { Chyron } from "./schema";
import { PL_THEME } from "./theme";

const cache = new Map<string, { image: string; height: number }>();

/** Word wrap never clips long names. Oversized words wrap at grapheme boundaries. */
export function wrapText(text: string, width: number, measure: (text: string) => number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split("\n")) {
		let line = "";
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			const candidate = line ? `${line} ${word}` : word;
			if (measure(candidate) <= width) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = "";
			for (const letter of Array.from(word)) {
				if (line && measure(line + letter) > width) {
					lines.push(line);
					line = "";
				}
				line += letter;
			}
		}
		lines.push(line);
	}
	return lines;
}

/** Derived RGBA texture only; semantic fields remain in the project, never the cached bitmap.
 * Rasterize at twice the 1080 reference size so 4K exports retain real glyph detail.
 * The SAME image is consumed by native preview and export, avoiding system-font substitution.
 */
export function rasterizeChyron(chyron: Chyron, width: number): { image: string; height: number } {
	if (!studioFontStatus.ready)
		throw new Error(
			`Video fonts unavailable: ${studioFontStatus.missing.join(", ") || "still loading"}`,
		);
	const key = JSON.stringify([chyron, width]);
	const prior = cache.get(key);
	if (prior) return prior;
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Cannot create the chyron graphics surface.");
	const outer = 16;
	const pad = chyron.padding + outer;
	const available = Math.max(30, width - pad * 2);
	context.font = `600 ${chyron.headlineSize}px "${PL_THEME.headingFont}"`;
	const headline = wrapText(chyron.headline, available, (text) => context.measureText(text).width);
	context.font = `400 ${chyron.supportingSize}px "${PL_THEME.bodyFont}"`;
	const supporting = chyron.supporting
		? wrapText(chyron.supporting, available, (text) => context.measureText(text).width)
		: [];
	const headlineHeight = headline.length * chyron.headlineSize * 1.2;
	const height =
		pad * 2 +
		headlineHeight +
		(supporting.length ? 12 + supporting.length * chyron.supportingSize * 1.35 : 0);
	canvas.width = Math.ceil(width * 2);
	canvas.height = Math.ceil(height * 2);
	context.scale(2, 2);
	if (chyron.variant !== "editorial") {
		context.save();
		context.shadowColor = "#00000066";
		context.shadowBlur = chyron.variant === "soft-panel" ? 14 : 4;
		context.shadowOffsetY = 5;
		context.globalAlpha = chyron.panelOpacity;
		context.fillStyle = chyron.panelColor;
		context.beginPath();
		context.roundRect(
			outer,
			outer,
			width - outer * 2,
			height - outer * 2,
			chyron.variant === "soft-panel" ? 20 : 8,
		);
		context.fill();
		context.restore();
		if (chyron.variant === "spotlight") {
			context.strokeStyle = PL_THEME.border;
			context.lineWidth = 1.5;
			context.stroke();
		}
	}
	context.textBaseline = "top";
	context.textAlign = chyron.align;
	const x = chyron.align === "center" ? width / 2 : chyron.align === "right" ? width - pad : pad;
	context.font = `600 ${chyron.headlineSize}px "${PL_THEME.headingFont}"`;
	context.fillStyle = chyron.color;
	if (chyron.variant === "editorial") {
		context.shadowColor = "#000000aa";
		context.shadowBlur = 5;
	}
	headline.forEach((line, index) =>
		context.fillText(line, x, pad + index * chyron.headlineSize * 1.2),
	);
	context.font = `400 ${chyron.supportingSize}px "${PL_THEME.bodyFont}"`;
	context.fillStyle = chyron.supportingColor;
	supporting.forEach((line, index) =>
		context.fillText(line, x, pad + headlineHeight + 12 + index * chyron.supportingSize * 1.35),
	);
	const result = { image: canvas.toDataURL("image/png"), height };
	if (cache.size >= 64) cache.delete(cache.keys().next().value ?? "");
	cache.set(key, result);
	return result;
}

export function chyronGeometry(region: AxcutAnnotationRegion, aspect: number) {
	if (!region.chyron) return { ...region.position, ...region.size };
	const referenceWidth = 1080 * aspect;
	const width = Math.min(90, Math.max(25, region.size.width));
	const { height: pixels } = rasterizeChyron(region.chyron, (referenceWidth * width) / 100);
	const height = (pixels / 1080) * 100;
	return {
		x: Math.max(5, Math.min(95 - width, region.position.x)),
		y: Math.max(5, Math.min(95 - height, region.position.y)),
		width,
		height,
	};
}

/** Caption texture uses the loaded application font, including in native exports. */
export function rasterizeCaption(
	region: AxcutAnnotationRegion,
	aspect: number,
	edge?: "top" | "bottom",
) {
	if (!studioFontStatus.ready) throw new Error("Caption fonts have not loaded.");
	const width = (1080 * aspect * region.size.width) / 100;
	const size = region.style.fontSize;
	const key = JSON.stringify(["caption", region.content, region.style, width]);
	let raster = cache.get(key);
	if (!raster) {
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Cannot create caption graphics.");
		const font = `${region.style.fontWeight === "bold" ? 700 : 400} ${size}px "${PL_THEME.bodyFont}"`;
		ctx.font = font;
		const pad = size * 0.35;
		const lines = wrapText(
			region.content,
			Math.max(1, width - pad * 2),
			(text) => ctx.measureText(text).width,
		);
		const height = lines.length * size * 1.3 + pad * 2;
		canvas.width = Math.ceil(width * 2);
		canvas.height = Math.ceil(height * 2);
		ctx.scale(2, 2);
		ctx.font = font;
		const plateWidth = Math.min(
			width,
			Math.max(...lines.map((line) => ctx.measureText(line).width)) + pad * 2,
		);
		const align = region.style.textAlign;
		const left =
			align === "center" ? (width - plateWidth) / 2 : align === "right" ? width - plateWidth : 0;
		ctx.fillStyle = region.style.backgroundColor;
		ctx.beginPath();
		ctx.roundRect(left, 0, plateWidth, height, 8);
		ctx.fill();
		ctx.fillStyle = region.style.color;
		ctx.textBaseline = "top";
		ctx.textAlign = align;
		const x = align === "center" ? width / 2 : align === "right" ? width - pad : pad;
		lines.forEach((line, i) => ctx.fillText(line, x, pad + size * 1.3 * i));
		raster = { image: canvas.toDataURL("image/png"), height };
		if (cache.size >= 64) cache.delete(cache.keys().next().value ?? "");
		cache.set(key, raster);
	}
	const height = raster.height / 1080;
	const y = region.position.y / 100 + (edge === "bottom" ? region.size.height / 100 - height : 0);
	return { image: raster.image, height, y: Math.max(0, Math.min(1 - height, y)) };
}

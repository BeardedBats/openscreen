import { PL_THEME } from "./theme";

export const studioFontStatus = { ready: false, missing: [] as string[] };

/** Await real font loads before any composition is rasterized. Never report fallback as a match. */
export async function loadStudioFonts() {
	const faces = [
		[PL_THEME.headingFont, "InstrumentSans.ttf", "400 700"],
		...["Regular", "Medium", "Semibold", "Bold"].map((name, index) => [
			PL_THEME.bodyFont,
			`SF-Pro-Text-${name}.otf`,
			String(400 + index * 100),
		]),
	];
	await Promise.all(
		faces.map(async ([family, file, weight]) => {
			try {
				const font = new FontFace(
					family,
					`url(${new URL(`fonts/${file}`, document.baseURI).href})`,
					{ weight },
				);
				await font.load();
				document.fonts.add(font);
			} catch {
				studioFontStatus.missing.push(file);
			}
		}),
	);
	studioFontStatus.ready = studioFontStatus.missing.length === 0;
}

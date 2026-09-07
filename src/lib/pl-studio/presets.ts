import { getCaptionSettings, patchCaptionSettings } from "../ai-edition/captions/settings";
import type { AxcutDocument } from "../ai-edition/schema";
import { type EditorSettingsPatch, patchEditorSettings } from "../ai-edition/store/editorSettings";

/** Apply only the explicitly saved composition, once when creating a new project. */
export function applySavedComposition(doc: AxcutDocument): AxcutDocument {
	try {
		const text = globalThis.localStorage?.getItem("pl-studio-preset-Composition");
		if (!text) return doc;
		const saved = JSON.parse(text) as {
			version?: number;
			settings?: EditorSettingsPatch;
			captions?: unknown;
		};
		if (saved.version !== 1 || !saved.settings || typeof saved.settings !== "object") return doc;
		let next = patchEditorSettings(doc, saved.settings);
		if (saved.captions)
			next = patchCaptionSettings(
				next,
				getCaptionSettings({
					...next,
					legacyEditor: { ...next.legacyEditor, captions: saved.captions },
				}),
			);
		return next;
	} catch {
		return doc;
	}
}

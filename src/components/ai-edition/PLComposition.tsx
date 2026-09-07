import { useState } from "react";
import { toast } from "sonner";
import { getCaptionSettings, patchCaptionSettings } from "@/lib/ai-edition/captions/settings";
import type { AxcutDocument } from "@/lib/ai-edition/schema";
import {
	type EditorSettingsPatch,
	getEditorSettings,
	patchEditorSettings,
} from "@/lib/ai-edition/store/editorSettings";
import { useProjectStore } from "@/lib/ai-edition/store/projectStore";
import type { useTimeline } from "@/lib/ai-edition/store/useTimeline";
import { addChyron, templateChyron } from "@/lib/pl-studio/chyrons";

const groups = ["Composition", "Screen", "Camera", "Cursor", "Captions"] as const;
type Group = (typeof groups)[number];
function scoped(doc: AxcutDocument, group: Group): EditorSettingsPatch {
	const s = getEditorSettings(doc);
	const screen = {
		wallpaper: s.wallpaper,
		padding: s.padding,
		borderRadius: s.borderRadius,
		shadowIntensity: s.shadowIntensity,
		showBlur: s.showBlur,
	};
	const camera = {
		webcamLayoutPreset: s.webcamLayoutPreset,
		webcamMaskShape: s.webcamMaskShape,
		webcamSizePreset: s.webcamSizePreset,
		webcamPosition: s.webcamPosition,
		webcamCropRegion: s.webcamCropRegion,
		webcamCropPan: s.webcamCropPan,
		webcamMirrored: s.webcamMirrored,
		webcamReactiveZoom: s.webcamReactiveZoom,
	};
	const cursor = { cursor: { ...s.cursor, show: s.cursorShow, theme: s.cursorTheme } };
	return group === "Screen"
		? screen
		: group === "Camera"
			? camera
			: group === "Cursor"
				? cursor
				: group === "Captions"
					? {}
					: {
							...screen,
							...camera,
							...cursor,
							aspectRatio: s.aspectRatio,
							motionBlurAmount: s.motionBlurAmount,
						};
}

export function CompositionControls({ tl }: { tl: ReturnType<typeof useTimeline> }) {
	const doc = useProjectStore((s) => s.document);
	const [group, setGroup] = useState<Group>("Composition");
	if (!doc) return null;
	const save = (next: AxcutDocument) =>
		void useProjectStore.getState().saveDocument(next, { history: true });
	const patch = (value: EditorSettingsPatch) => save(patchEditorSettings(doc, value));
	const settings = getEditorSettings(doc);
	const hasCamera = doc.assets.some(
		(a) => a.cameraTrack && doc.timeline.clips.some((c) => c.assetId === a.id),
	);
	const cameraLayout = (value: EditorSettingsPatch) => {
		if (!hasCamera) {
			toast.info("This layout needs a clip with a linked camera recording.");
			return;
		}
		patch(value);
	};
	return (
		<div className="pl-pane">
			<h2>Composition</h2>
			<button
				type="button"
				onClick={() =>
					save({
						...doc,
						legacyEditor: { ...doc.legacyEditor, plStyleLocked: !doc.legacyEditor?.plStyleLocked },
					})
				}
			>
				{doc.legacyEditor?.plStyleLocked ? "Unlock composition for AI" : "Lock composition for AI"}
			</button>
			<div className="pl-row">
				<button
					type="button"
					onClick={() =>
						patch({
							webcamLayoutPreset: "no-webcam",
							padding: 0,
							borderRadius: 0,
							shadowIntensity: 0,
						})
					}
				>
					Screen full frame
				</button>
				<button
					type="button"
					onClick={() =>
						patch({
							webcamLayoutPreset: "no-webcam",
							padding: 28,
							borderRadius: 24,
							shadowIntensity: 0.18,
							wallpaper: "#091421",
						})
					}
				>
					Framed screen
				</button>
				<button
					type="button"
					onClick={() =>
						cameraLayout({
							webcamLayoutPreset: "picture-in-picture",
							webcamMaskShape: "circle",
							webcamSizePreset: 22,
						})
					}
				>
					Screen + circle camera
				</button>
				<button
					type="button"
					onClick={() =>
						cameraLayout({
							webcamLayoutPreset: "picture-in-picture",
							webcamMaskShape: "rounded",
							webcamSizePreset: 25,
						})
					}
				>
					Screen + rounded camera
				</button>
				<button type="button" onClick={() => cameraLayout({ webcamLayoutPreset: "dual-frame" })}>
					Split view
				</button>
				<button
					type="button"
					onClick={() => {
						if (hasCamera) void tl.addCameraFullscreen(4);
						else toast.info("Link a camera recording first.");
					}}
				>
					Presenter full screen
				</button>
				<button
					type="button"
					onClick={() => {
						try {
							save(
								addChyron(
									doc,
									templateChyron("closing"),
									useProjectStore.getState().currentTimeSec,
								),
							);
						} catch (e) {
							toast.error(String(e));
						}
					}}
				>
					Closing layout
				</button>
			</div>
			<label>
				Output shape
				<select
					value={settings.aspectRatio}
					onChange={(e) => patch({ aspectRatio: e.target.value as typeof settings.aspectRatio })}
				>
					{["16:9", "9:16", "1:1", "4:5"].map((value) => (
						<option key={value}>{value}</option>
					))}
				</select>
			</label>
			{settings.aspectRatio !== "16:9" && (
				<p className="pl-notice">
					Wide tables may become too small. Select Edit clip to adjust the crop while keeping names
					and headers visible.
				</p>
			)}
			<div className="pl-row">
				{[
					{ name: "Top left", cx: 0.15, cy: 0.18 },
					{ name: "Top right", cx: 0.85, cy: 0.18 },
					{ name: "Bottom left", cx: 0.15, cy: 0.82 },
					{ name: "Bottom right", cx: 0.85, cy: 0.82 },
				].map(({ name, cx, cy }) => (
					<button
						type="button"
						key={name}
						onClick={() =>
							cameraLayout({ webcamPosition: { cx, cy }, webcamLayoutPreset: "picture-in-picture" })
						}
					>
						{name}
					</button>
				))}
			</div>
			<hr />
			<label>
				Saved default
				<select value={group} onChange={(e) => setGroup(e.target.value as Group)}>
					{groups.map((g) => (
						<option key={g}>{g}</option>
					))}
				</select>
			</label>
			<div className="pl-row">
				<button
					type="button"
					onClick={() => {
						try {
							localStorage.setItem(
								`pl-studio-preset-${group}`,
								JSON.stringify({
									version: 1,
									settings: scoped(doc, group),
									captions:
										group === "Composition" || group === "Captions"
											? getCaptionSettings(doc)
											: undefined,
								}),
							);
							toast.success(`${group} default saved`);
						} catch {
							toast.error("Could not save this default.");
						}
					}}
				>
					Save current default
				</button>
				<button
					type="button"
					onClick={() => {
						try {
							const raw = JSON.parse(localStorage.getItem(`pl-studio-preset-${group}`) ?? "null");
							if (raw?.version !== 1) {
								toast.info("Save a default for this feature first.");
								return;
							}
							let next = patchEditorSettings(
								doc,
								scoped(patchEditorSettings(doc, raw.settings), group),
							);
							if (raw.captions && (group === "Composition" || group === "Captions"))
								next = patchCaptionSettings(
									next,
									getCaptionSettings({
										...next,
										legacyEditor: { ...next.legacyEditor, captions: raw.captions },
									}),
								);
							save(next);
						} catch {
							toast.error("This saved default cannot be read.");
						}
					}}
				>
					Apply saved default
				</button>
			</div>
		</div>
	);
}

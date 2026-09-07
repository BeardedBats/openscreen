import type { CameraFullscreenRegion } from "../../components/video-editor/types";
import { createId } from "../ai-edition/document/ids";
import type { AxcutDocument } from "../ai-edition/schema";
import { patchEditorSettings } from "../ai-edition/store/editorSettings";
import { anchorRegionsWithDerivedMs } from "../ai-edition/timeline/timelineMap";

export function presenterToCorner(
	doc: AxcutDocument,
	atSec: number,
	transitionMs = 600,
): AxcutDocument {
	const clip = doc.timeline.clips.find(
		(c) => atSec >= c.timelineStartSec && atSec < c.timelineEndSec,
	);
	if (!clip || !doc.assets.find((a) => a.id === clip.assetId)?.cameraTrack)
		throw new Error("Select a clip with a linked camera recording.");
	const previous = (doc.legacyEditor?.cameraFullscreenRegions ?? []) as CameraFullscreenRegion[];
	const region: CameraFullscreenRegion = {
		id: createId("camfull"),
		startMs: clip.timelineStartSec * 1000,
		endMs: Math.min(clip.timelineEndSec * 1000, atSec * 1000 + transitionMs),
		startFullscreen: true,
		transitionMs,
	};
	return {
		...patchEditorSettings(doc, {
			webcamLayoutPreset: "picture-in-picture",
			webcamPosition: { cx: 0.85, cy: 0.82 },
		}),
		legacyEditor: {
			...patchEditorSettings(doc, {
				webcamLayoutPreset: "picture-in-picture",
				webcamPosition: { cx: 0.85, cy: 0.82 },
			}).legacyEditor,
			cameraFullscreenRegions: [
				...previous.filter((r) => r.endMs <= region.startMs || r.startMs >= region.endMs),
				...anchorRegionsWithDerivedMs([region], doc.timeline.clips, () => createId("camfull")),
			],
		},
	};
}

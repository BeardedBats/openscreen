import { createId } from "../ai-edition/document/ids";
import type { AxcutDocument } from "../ai-edition/schema";

/** Only explicit transcript silence is eligible. Never delete words for spelling changes. */
export function tightenPauses(doc: AxcutDocument): AxcutDocument {
	const added: AxcutDocument["timeline"]["trimRanges"] = [];
	const locked = [
		...doc.zoomRanges.filter((z) => z.locked),
		...doc.annotations.filter((a) => a.chyron?.locked),
	];
	for (const clip of doc.timeline.clips) {
		const transcript =
			doc.transcripts.find((t) => t.assetId === clip.assetId) ??
			(doc.transcript?.assetId === clip.assetId ? doc.transcript : null);
		for (const segment of transcript?.segments ?? []) {
			if (segment.kind !== "silence") continue;
			const startSec = Math.max(clip.sourceStartSec, segment.startSec) + 0.25;
			const endSec = Math.min(clip.sourceEndSec ?? segment.endSec, segment.endSec) - 0.25;
			if (endSec - startSec < 0.7) continue;
			if (
				locked.some(
					(r) =>
						r.clipId === clip.id &&
						(r.sourceStartSec ?? 0) < endSec &&
						(r.sourceEndSec ?? Infinity) > startSec,
				)
			)
				continue;
			if (
				doc.timeline.trimRanges.some(
					(r) =>
						(r.clipId ? r.clipId === clip.id : r.assetId === clip.assetId) &&
						r.startSec < endSec &&
						r.endSec > startSec,
				)
			)
				continue;
			added.push({
				origin: "user",
				id: createId("trim"),
				assetId: clip.assetId,
				clipId: clip.id,
				startSec,
				endSec,
				reason: "Tighten explicit transcript silence; retain 250ms at both edges",
			});
		}
	}
	return {
		...doc,
		timeline: { ...doc.timeline, trimRanges: [...doc.timeline.trimRanges, ...added] },
	};
}

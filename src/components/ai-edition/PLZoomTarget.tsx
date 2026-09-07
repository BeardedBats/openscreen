import { useRef, useState } from "react";
import { create } from "zustand";
import { useProjectStore } from "@/lib/ai-edition/store/projectStore";
import { resolvePillIds } from "@/lib/ai-edition/timeline/timelineMap";

export const useZoomTarget = create<{ id: string | null; select: (id: string | null) => void }>(
	(set) => ({ id: null, select: (id) => set({ id }) }),
);

function patchPillById<T extends { id: string; startMs: number; endMs: number }>(
	regions: T[],
	id: string,
	patch: Partial<T>,
): T[] {
	const ids = new Set(resolvePillIds(regions, id));
	return regions.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r));
}

/** Input overlay only. Authored focus and depth go back through the normal document. */
export function PLZoomTarget() {
	const id = useZoomTarget((s) => s.id);
	const start = useRef<{ x: number; y: number } | null>(null);
	const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
	const clear = () => {
		start.current = null;
		setBox(null);
	};
	if (!id) return null;
	const point = (event: React.PointerEvent<HTMLDivElement>) => {
		const r = event.currentTarget.getBoundingClientRect();
		return {
			x: Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)),
			y: Math.min(1, Math.max(0, (event.clientY - r.top) / r.height)),
		};
	};
	return (
		<div
			role="application"
			aria-label="Draw zoom target"
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 100,
				cursor: "crosshair",
				touchAction: "none",
				background: "#09142122",
			}}
			onPointerDown={(e) => {
				start.current = point(e);
				e.currentTarget.setPointerCapture(e.pointerId);
			}}
			onPointerMove={(e) => {
				if (!start.current) return;
				const p = point(e),
					s = start.current;
				setBox({
					x: Math.min(s.x, p.x),
					y: Math.min(s.y, p.y),
					w: Math.abs(p.x - s.x),
					h: Math.abs(p.y - s.y),
				});
			}}
			onPointerCancel={clear}
			onPointerUp={(e) => {
				if (!start.current) return;
				const p = point(e),
					s = start.current;
				const w = Math.max(0.05, Math.abs(p.x - s.x)),
					h = Math.max(0.05, Math.abs(p.y - s.y));
				const state = useProjectStore.getState(),
					doc = state.document;
				if (doc)
					void state.saveDocument(
						{
							...doc,
							zoomRanges: patchPillById(doc.zoomRanges, id, {
								focusMode: "manual" as const,
								locked: true,
								entryMs: 600,
								exitMs: 600,
								easing: "smooth" as const,
								customScale: Math.min(5, Math.max(1, Math.min(1 / w, 1 / h))),
								focus: { cx: (s.x + p.x) / 2, cy: (s.y + p.y) / 2 },
							}),
						},
						{ history: true },
					);
				e.currentTarget.releasePointerCapture(e.pointerId);
				clear();
				useZoomTarget.getState().select(null);
			}}
		>
			<span
				style={{
					position: "absolute",
					left: 12,
					top: 12,
					background: "#091421",
					color: "#f2f7fc",
					padding: 10,
					fontSize: 14,
					pointerEvents: "none",
				}}
			>
				Include names, headers, and any related areas in this frame.
			</span>
			{box && (
				<div
					style={{
						pointerEvents: "none",
						position: "absolute",
						left: `${box.x * 100}%`,
						top: `${box.y * 100}%`,
						width: `${box.w * 100}%`,
						height: `${box.h * 100}%`,
						border: "2px solid #67dcf2",
						background: "#67dcf21a",
					}}
				/>
			)}
			<button
				type="button"
				style={{
					position: "absolute",
					right: 10,
					bottom: 10,
					padding: 10,
					background: "#112337",
					color: "white",
				}}
				onPointerDown={(e) => e.stopPropagation()}
				onClick={() => {
					clear();
					useZoomTarget.getState().select(null);
				}}
			>
				Cancel target
			</button>
		</div>
	);
}

export function ZoomQuickControls({ id }: { id: string }) {
	const doc = useProjectStore((s) => s.document);
	const region = doc?.zoomRanges.find((z) => z.id === id);
	if (!doc || !region) return null;
	const patch = (value: Partial<typeof region>) =>
		void useProjectStore
			.getState()
			.saveDocument(
				{ ...doc, zoomRanges: patchPillById(doc.zoomRanges, id, value) },
				{ history: true },
			);
	return (
		<div className="pl-pane">
			<div className="pl-row">
				<button type="button" onClick={() => useZoomTarget.getState().select(id)}>
					Draw target
				</button>
				<button type="button" onClick={() => patch({ focusMode: "manual", locked: true })}>
					Hold Here
				</button>
				<button type="button" onClick={() => patch({ focusMode: "auto", locked: false })}>
					Follow Cursor
				</button>
				<button type="button" onClick={() => patch({ customScale: 1, focusMode: "manual" })}>
					Return to Full View
				</button>
				<button type="button" onClick={() => patch({ locked: !region.locked })}>
					{region.locked ? "Unlock This Zoom" : "Lock This Zoom"}
				</button>
			</div>
			<label>
				Entrance (ms)
				<input
					type="number"
					min={0}
					max={3000}
					step={50}
					value={region.entryMs ?? 600}
					onChange={(e) => {
						const n = e.target.valueAsNumber;
						if (n >= 0 && n <= 3000) patch({ entryMs: n });
					}}
				/>
			</label>
			<label>
				Exit (ms)
				<input
					type="number"
					min={0}
					max={3000}
					step={50}
					value={region.exitMs ?? 600}
					onChange={(e) => {
						const n = e.target.valueAsNumber;
						if (n >= 0 && n <= 3000) patch({ exitMs: n });
					}}
				/>
			</label>
			<label>
				Easing
				<select
					value={region.easing ?? "smooth"}
					onChange={(e) => patch({ easing: e.target.value as typeof region.easing })}
				>
					<option value="smooth">Smooth</option>
					<option value="linear">Linear</option>
					<option value="cut">Hard cut</option>
				</select>
			</label>
			<button
				type="button"
				onClick={() => patch({ customScale: 1, locked: true, focusMode: "manual" })}
			>
				Disable Zoom for This Section
			</button>
			<p>Follow Cursor needs recorded cursor telemetry. Imported video can use manual targets.</p>
			{(region.customScale ?? 1) > 2 && (
				<p className="pl-notice">
					This crop uses less than half the source width. Check table text at export size.
				</p>
			)}
		</div>
	);
}

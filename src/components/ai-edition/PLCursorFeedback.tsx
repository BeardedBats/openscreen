import { useProjectStore } from "@/lib/ai-edition/store/projectStore";
import { getClickFeedback } from "@/lib/pl-studio/clickFeedback";
export function CursorFeedbackControls() {
	const doc = useProjectStore((s) => s.document);
	if (!doc) return null;
	const value = getClickFeedback(doc);
	const patch = (next: Partial<typeof value>) =>
		void useProjectStore
			.getState()
			.saveDocument(
				{ ...doc, legacyEditor: { ...doc.legacyEditor, plClickFeedback: { ...value, ...next } } },
				{ history: true },
			);
	return (
		<div className="pl-pane">
			<h2>Click feedback</h2>
			<p>
				Rings use captured cursor events. Video imports without telemetry keep their original
				pointer.
			</p>
			<button type="button" onClick={() => patch({ enabled: !value.enabled })}>
				{value.enabled ? "Disable click rings" : "Enable click rings"}
			</button>
			<label>
				Ring color
				<input
					type="color"
					value={value.color}
					onChange={(e) => patch({ color: e.target.value })}
				/>
			</label>
			{(
				[
					["opacity", "Opacity", 0, 1, 0.05],
					["size", "Size at 1080p", 24, 160, 4],
					["durationMs", "Duration (ms)", 100, 1500, 50],
				] as const
			).map(([key, label, min, max, step]) => (
				<label key={key}>
					{label}
					<input
						type="range"
						min={min}
						max={max}
						step={step}
						value={value[key]}
						onChange={(e) => patch({ [key]: e.target.valueAsNumber })}
					/>
					<span>{value[key]}</span>
				</label>
			))}
		</div>
	);
}

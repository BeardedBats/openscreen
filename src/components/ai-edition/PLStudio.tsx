import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deriveCaptionCues } from "@/lib/ai-edition/captions/cues";
import {
	captionBoxRect,
	getCaptionSettings,
	patchCaptionSettings,
} from "@/lib/ai-edition/captions/settings";
import { getCaptionTranslations } from "@/lib/ai-edition/captions/translations";
import {
	type AxcutAnnotationRegion,
	type AxcutDocument,
	documentSchema,
} from "@/lib/ai-edition/schema";
import { getEditorSettings, patchEditorSettings } from "@/lib/ai-edition/store/editorSettings";
import { useProjectStore } from "@/lib/ai-edition/store/projectStore";
import { redo, undo } from "@/lib/ai-edition/store/undo";
import { useChatPromptBus } from "@/lib/ai-edition/store/useChatPromptBus";
import type { useTimeline } from "@/lib/ai-edition/store/useTimeline";
import {
	addChyron,
	CHYRON_TEMPLATES,
	chyronMotion,
	replaceChyron,
	templateChyron,
} from "@/lib/pl-studio/chyrons";
import { studioFontStatus } from "@/lib/pl-studio/fonts";
import { presenterToCorner } from "@/lib/pl-studio/layouts";
import { tightenPauses } from "@/lib/pl-studio/pauses";
import { chyronGeometry, rasterizeChyron } from "@/lib/pl-studio/rasterize";
import {
	type Chyron,
	type ChyronTemplate,
	type ChyronVariant,
	chyronSchema,
} from "@/lib/pl-studio/schema";
import { serializeSubtitles } from "@/lib/pl-studio/subtitles";
import { PL_THEME } from "@/lib/pl-studio/theme";
import { buildSceneDescription } from "@/native/sceneDescription";

import { useZoomTarget } from "./PLZoomTarget";

type Timeline = ReturnType<typeof useTimeline>;

export function CaptionTools() {
	const doc = useProjectStore((s) => s.document);
	const [glossary, setGlossary] = useState("");
	useEffect(
		() =>
			setGlossary(
				String(
					doc?.legacyEditor?.plGlossary ?? "Pitcher List\nPL Pro\nPLV\nProcess+\nNick Pollack",
				),
			),
		[doc?.legacyEditor?.plGlossary],
	);
	if (!doc) return null;
	return (
		<div className="pl-pane">
			<div className="pl-row">
				{(["srt", "vtt"] as const).map((format) => (
					<button
						type="button"
						key={format}
						onClick={() => {
							const text = serializeSubtitles(doc, format);
							if (!text.includes("-->")) {
								toast.info("Transcribe a clip before exporting captions.");
								return;
							}
							const url = URL.createObjectURL(
								new Blob([text], { type: "text/plain;charset=utf-8" }),
							);
							const link = document.createElement("a");
							link.href = url;
							link.download = `${doc.project.title.replace(/[<>:"/\\|?*]/g, "-")}.${format}`;
							link.click();
							setTimeout(() => URL.revokeObjectURL(url), 10000);
						}}
					>
						Export {format.toUpperCase()}
					</button>
				))}
			</div>
			<details>
				<summary>Spelling glossary</summary>
				<p>
					Reference spellings for transcript corrections. Editing this list does not change spoken
					words or cut video.
				</p>
				<label>
					Names and terms
					<textarea value={glossary} onChange={(e) => setGlossary(e.target.value)} />
				</label>
				<button
					type="button"
					onClick={() =>
						void save({ ...doc, legacyEditor: { ...doc.legacyEditor, plGlossary: glossary } })
					}
				>
					Save glossary
				</button>
			</details>
		</div>
	);
}

export function CameraTransitionControls({ id }: { id: string }) {
	const doc = useProjectStore((s) => s.document);
	if (!doc) return null;
	const regions = (doc.legacyEditor?.cameraFullscreenRegions ?? []) as {
		id: string;
		transitionMs?: number;
		startFullscreen?: boolean;
	}[];
	const region = regions.find((r) => r.id === id);
	if (!region) return null;
	const patch = (value: { transitionMs?: number; startFullscreen?: boolean }) =>
		void save({
			...doc,
			legacyEditor: {
				...doc.legacyEditor,
				cameraFullscreenRegions: regions.map((r) => (r.id === id ? { ...r, ...value } : r)),
			},
		});
	return (
		<div className="pl-pane">
			<label>
				Transition duration (ms)
				<input
					type="number"
					min={200}
					max={1500}
					step={50}
					value={region.transitionMs ?? 600}
					onChange={(e) => {
						if (e.target.valueAsNumber >= 200 && e.target.valueAsNumber <= 1500)
							patch({ transitionMs: e.target.valueAsNumber });
					}}
				/>
			</label>
			<div className="pl-row">
				<button type="button" onClick={() => patch({ transitionMs: 0 })}>
					Hard cut
				</button>
				<button type="button" onClick={() => patch({ transitionMs: 600 })}>
					Smooth transition
				</button>
				<button type="button" onClick={() => patch({ startFullscreen: !region.startFullscreen })}>
					{region.startFullscreen ? "Animate into full screen" : "Start full screen"}
				</button>
			</div>
		</div>
	);
}

async function save(doc: AxcutDocument) {
	return useProjectStore.getState().saveDocument(doc, { history: true });
}

function ChyronPreview({ value }: { value: Chyron }) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;
		if (!canvas || !studioFontStatus.ready) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		const raster = rasterizeChyron(value, 900);
		const image = new Image();
		image.src = raster.image;
		let frame = 0;
		let start = 0;
		const paint = (now: number) => {
			if (!start) start = now;
			const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			const motion = chyronMotion(value, reducedMotion ? 1500 : (now - start) % 5000, 4000);
			context.clearRect(0, 0, 900, 300);
			context.globalAlpha = motion.opacity;
			context.drawImage(
				image,
				0,
				0,
				image.width * motion.reveal,
				image.height,
				motion.x,
				Math.max(0, (300 - raster.height) / 2),
				900 * motion.reveal,
				raster.height,
			);
			if (!reducedMotion) frame = requestAnimationFrame(paint);
		};
		image.onload = () => {
			frame = requestAnimationFrame(paint);
		};
		return () => {
			image.onload = null;
			cancelAnimationFrame(frame);
		};
	}, [value]);
	return (
		<canvas
			ref={ref}
			width={900}
			height={300}
			aria-label={`${value.headline} animated chyron preview`}
		/>
	);
}

export function ChyronsPane({ tl }: { tl: Timeline }) {
	const doc = useProjectStore((s) => s.document);
	const [draft, setDraft] = useState(() => {
		try {
			return chyronSchema.parse(
				JSON.parse(localStorage.getItem("pl-studio-default-chyron") ?? "null"),
			);
		} catch {
			return templateChyron("section");
		}
	});
	const [custom, setCustom] = useState<Chyron[]>(() => {
		try {
			return chyronSchema
				.array()
				.parse(JSON.parse(localStorage.getItem("pl-studio-chyrons") ?? "[]"));
		} catch {
			return [];
		}
	});
	if (!doc) return <div className="pl-pane">Import a clip before adding chyrons.</div>;
	const add = async () => {
		try {
			const next = addChyron(doc, draft, useProjectStore.getState().currentTimeSec);
			if (await save(next))
				tl.selectRegion("annotation", next.annotations[doc.annotations.length].id);
		} catch (error) {
			toast.error(String(error));
		}
	};
	return (
		<div className="pl-pane">
			<h2>Chyrons</h2>
			<p>Choose a template. Edit the copy, then place it at the playhead.</p>
			<button
				type="button"
				onClick={() => {
					const time = useProjectStore.getState().currentTimeSec * 1000;
					const cue = deriveCaptionCues(
						doc,
						{ ...getCaptionSettings(doc), enabled: true },
						getCaptionTranslations(doc),
					).find((c) => c.startMs <= time && c.endMs > time);
					if (!cue) {
						toast.info("Select a spoken passage or place the playhead over transcribed speech.");
						return;
					}
					setDraft((current) => ({ ...current, headline: cue.text }));
				}}
			>
				Use current transcript phrase
			</button>
			<div className="pl-library">
				{CHYRON_TEMPLATES.map((item) => (
					<button
						type="button"
						key={item.id}
						onClick={() => setDraft({ ...templateChyron(item.id), variant: draft.variant })}
					>
						<ChyronPreview value={{ ...templateChyron(item.id), variant: draft.variant }} />
						<strong>{item.title}</strong>
					</button>
				))}
			</div>
			<ChyronFields
				value={draft}
				onChange={(patch) => setDraft(chyronSchema.parse({ ...draft, ...patch }))}
			/>
			<div className="pl-row">
				<button type="button" onClick={() => void add()}>
					Add at playhead
				</button>
				<button
					type="button"
					onClick={() => {
						const next = [...custom, draft];
						try {
							localStorage.setItem("pl-studio-chyrons", JSON.stringify(next));
							setCustom(next);
						} catch {
							toast.error("Could not save this template. Local storage is full.");
						}
					}}
				>
					Save custom template
				</button>
			</div>
			{custom.length > 0 && (
				<>
					<hr />
					<h2>My templates</h2>
					{custom.map((item, index) => (
						<button type="button" key={`${item.headline}-${index}`} onClick={() => setDraft(item)}>
							{item.headline}
						</button>
					))}
				</>
			)}
		</div>
	);
}

function ChyronFields({
	value,
	onChange,
}: {
	value: Chyron;
	onChange: (patch: Partial<Chyron>) => void;
}) {
	return (
		<>
			<label>
				Headline
				<textarea value={value.headline} onChange={(e) => onChange({ headline: e.target.value })} />
			</label>
			<label>
				Supporting text
				<textarea
					value={value.supporting}
					onChange={(e) => onChange({ supporting: e.target.value })}
				/>
			</label>
			<label>
				Style
				<select
					value={value.variant}
					onChange={(e) =>
						onChange({
							variant: e.target.value as ChyronVariant,
							color: e.target.value === "spotlight" ? PL_THEME.cyan : PL_THEME.text,
						})
					}
				>
					<option value="editorial">Editorial</option>
					<option value="soft-panel">Soft Panel</option>
					<option value="spotlight">Spotlight</option>
				</select>
			</label>
			<label>
				Template
				<select
					value={value.template}
					onChange={(e) => onChange({ template: e.target.value as ChyronTemplate })}
				>
					{CHYRON_TEMPLATES.map((t) => (
						<option key={t.id} value={t.id}>
							{t.title}
						</option>
					))}
				</select>
			</label>
			<details>
				<summary>Typography, color and motion</summary>
				{(
					[
						["headlineSize", "Headline size", 24, 160],
						["supportingSize", "Supporting size", 18, 100],
						["padding", "Padding", 8, 100],
						["entryMs", "Entrance (ms)", 50, 1500],
						["exitMs", "Exit (ms)", 50, 1500],
					] as const
				).map(([key, label, min, max]) => (
					<label key={key}>
						{label}
						<input
							type="number"
							min={min}
							max={max}
							value={value[key]}
							onChange={(e) => {
								const n = e.target.valueAsNumber;
								if (n >= min && n <= max) onChange({ [key]: n });
							}}
						/>
					</label>
				))}
				<label>
					Alignment
					<select
						value={value.align}
						onChange={(e) => onChange({ align: e.target.value as Chyron["align"] })}
					>
						{["left", "center", "right"].map((x) => (
							<option key={x}>{x}</option>
						))}
					</select>
				</label>
				{(["color", "supportingColor", "panelColor"] as const).map((key) => (
					<label key={key}>
						{key === "color"
							? "Headline color"
							: key === "supportingColor"
								? "Supporting color"
								: "Panel color"}
						<input
							type="color"
							value={value[key]}
							onChange={(e) => onChange({ [key]: e.target.value })}
						/>
					</label>
				))}
				<label>
					Panel opacity
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={value.panelOpacity}
						onChange={(e) => onChange({ panelOpacity: e.target.valueAsNumber })}
					/>
				</label>
				{(["entry", "exit"] as const).map((key) => (
					<label key={key}>
						{key === "entry" ? "Entrance" : "Exit"}
						<select value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })}>
							{["slide", "fade", "reveal", "cut"].map((x) => (
								<option key={x}>{x}</option>
							))}
						</select>
					</label>
				))}
			</details>
		</>
	);
}

export function ChyronInspector({ region, tl }: { region: AxcutAnnotationRegion; tl: Timeline }) {
	const doc = useProjectStore((s) => s.document);
	const [draft, setDraft] = useState(region.chyron!);
	useEffect(() => setDraft(region.chyron!), [region]);
	if (!doc || !region.chyron) return null;
	const apply = () => void save(replaceChyron(doc, region.id, draft));
	const settings = getEditorSettings(doc);
	const aspect = settings.aspectRatio.split(":").map(Number);
	const geometry = chyronGeometry(region, aspect[0] / aspect[1] || 16 / 9);
	const captionSettings = getCaptionSettings(doc, aspect[0] / aspect[1] || 16 / 9);
	const captionBox = captionBoxRect(captionSettings, aspect[0] / aspect[1] || 16 / 9);
	const intersects = (b: { x: number; y: number; width: number; height: number }) =>
		geometry.x < b.x + b.width &&
		geometry.x + geometry.width > b.x &&
		geometry.y < b.y + b.height &&
		geometry.y + geometry.height > b.y;
	const overlapsCaptions =
		intersects(captionBox) &&
		deriveCaptionCues(doc, captionSettings, {}).some(
			(c) => c.startMs < region.endMs && c.endMs > region.startMs,
		);
	const camera = buildSceneDescription(doc).layout.webcamRect;
	const overlapsCamera =
		camera &&
		intersects({
			x: camera.x * 100,
			y: camera.y * 100,
			width: camera.width * 100,
			height: camera.height * 100,
		});
	const place = (x: number, y: number) => {
		tl.updateAnnotationLive(region.id, { position: { x, y } });
		void tl.commitAnnotationChange();
	};
	return (
		<div className="pl-pane">
			<h2>Edit chyron</h2>
			<ChyronPreview value={draft} />
			<ChyronFields
				value={draft}
				onChange={(patch) => setDraft(chyronSchema.parse({ ...draft, ...patch }))}
			/>
			<button type="button" onClick={apply}>
				Apply changes
			</button>
			<label>
				Width (%)
				<input
					type="number"
					min={25}
					max={90}
					value={region.size.width}
					onChange={(e) => {
						if (e.target.valueAsNumber >= 25 && e.target.valueAsNumber <= 90) {
							tl.updateAnnotationLive(region.id, {
								size: { ...region.size, width: e.target.valueAsNumber },
							});
							void tl.commitAnnotationChange();
						}
					}}
				/>
			</label>
			<p>Drag the chyron in the preview. Trim or move its range on the timeline.</p>
			<label>
				Start (seconds)
				<input
					type="number"
					min={0}
					step={0.1}
					value={region.startMs / 1000}
					onChange={(e) => {
						const value = e.target.valueAsNumber;
						if (Number.isFinite(value) && value >= 0)
							void tl.updateAnnotationSpan(
								region.id,
								value * 1000,
								value * 1000 + region.endMs - region.startMs,
							);
					}}
				/>
			</label>
			<label>
				Duration (seconds)
				<input
					type="number"
					min={0.5}
					step={0.1}
					value={(region.endMs - region.startMs) / 1000}
					onChange={(e) => {
						const value = e.target.valueAsNumber;
						if (Number.isFinite(value) && value >= 0.5)
							void tl.updateAnnotationSpan(
								region.id,
								region.startMs,
								region.startMs + value * 1000,
							);
					}}
				/>
			</label>
			<div className="pl-row">
				<button type="button" onClick={() => place(5, 70)}>
					Lower left
				</button>
				<button type="button" onClick={() => place(95 - geometry.width, 70)}>
					Lower right
				</button>
				<button type="button" onClick={() => place((100 - geometry.width) / 2, 70)}>
					Lower center
				</button>
				<button type="button" onClick={() => place(5, 5)}>
					Upper safe area
				</button>
			</div>
			{(overlapsCaptions || overlapsCamera) && (
				<p className="pl-notice">
					This placement overlaps {overlapsCaptions ? "captions" : "the corner camera"}. Try the
					upper safe area, or keep this position.
				</p>
			)}
			{geometry.height > 90 && (
				<p className="pl-notice">
					This copy exceeds the safe area. Shorten the text or increase the width.
				</p>
			)}
			<hr />
			<div className="pl-row">
				<button
					type="button"
					onClick={() => {
						try {
							void save(addChyron(doc, draft, useProjectStore.getState().currentTimeSec));
						} catch (e) {
							toast.error(String(e));
						}
					}}
				>
					Duplicate
				</button>
				<button
					type="button"
					onClick={() =>
						void save({
							...doc,
							annotations: doc.annotations.map((a) =>
								a.chyron && !a.chyron.locked
									? {
											...a,
											chyron: {
												...a.chyron,
												headlineSize: draft.headlineSize,
												supportingSize: draft.supportingSize,
												padding: draft.padding,
												align: draft.align,
												panelOpacity: draft.panelOpacity,
												entry: draft.entry,
												exit: draft.exit,
												entryMs: draft.entryMs,
												exitMs: draft.exitMs,
												variant: draft.variant,
												color: draft.color,
												panelColor: draft.panelColor,
												supportingColor: draft.supportingColor,
											},
										}
									: a,
							),
						})
					}
				>
					Apply style to all
				</button>
				<button
					type="button"
					onClick={() => {
						localStorage.setItem("pl-studio-default-chyron", JSON.stringify(draft));
						toast.success("Chyron default saved");
					}}
				>
					Save as default
				</button>
				<button
					type="button"
					onClick={() =>
						void save(replaceChyron(doc, region.id, { locked: !region.chyron?.locked }))
					}
				>
					{region.chyron.locked ? "Unlock AI edits" : "Lock AI edits"}
				</button>
				<button type="button" onClick={() => void tl.removeRegion("annotation", region.id)}>
					Delete chyron
				</button>
			</div>
		</div>
	);
}

export function StudioActions({
	tl,
	onChyrons,
	onTranscript,
}: {
	tl: Timeline;
	onChyrons: () => void;
	onTranscript: () => void;
}) {
	const doc = useProjectStore((s) => s.document);
	const [demoOpen, setDemoOpen] = useState(false);
	const [preset, setPreset] = useState("Product walkthrough");
	const [focus, setFocus] = useState("");
	const [duration, setDuration] = useState(60);
	if (!doc) return null;
	const hasCamera = doc.assets.some(
		(a) => a.cameraTrack && doc.timeline.clips.some((c) => c.assetId === a.id),
	);
	const afterHistory = () => {
		const current = useProjectStore.getState().document;
		if (current) void useProjectStore.getState().saveDocument(current, { history: false });
	};
	return (
		<>
			<div className="pl-actions">
				<button
					type="button"
					onClick={() =>
						void save(
							patchCaptionSettings(
								patchEditorSettings(doc, {
									wallpaper: PL_THEME.background,
									borderRadius: 24,
									padding: 28,
									shadowIntensity: 0.18,
									motionBlurAmount: 0,
									webcamMaskShape: "circle",
									webcamSizePreset: 22,
									webcamReactiveZoom: false,
									cursor: { size: 1.5, clickBounce: 0, smoothing: 0.35 },
								}),
								{
									fontFamily: PL_THEME.bodyFont,
									fontSize: 36,
									fontWeight: "normal",
									color: PL_THEME.text,
								},
							),
						)
					}
				>
					Apply PL Style
				</button>
				<button type="button" onClick={() => setDemoOpen(!demoOpen)}>
					Make a Demo
				</button>
				{doc.legacyEditor?.plAiRevision != null && (
					<button
						type="button"
						onClick={() => {
							const revision = doc.legacyEditor?.plAiRevision as { document?: unknown };
							const parsed = documentSchema.safeParse(revision.document);
							if (parsed.success) void save({ ...parsed.data, project: doc.project });
							else toast.error("The saved AI revision cannot be read.");
						}}
					>
						Restore before AI edit
					</button>
				)}
				<button
					type="button"
					onClick={() => {
						void save(patchCaptionSettings(doc, { enabled: true }));
						onTranscript();
					}}
				>
					Add Captions
				</button>
				<button
					type="button"
					onClick={async () => {
						await tl.addZoom(4);
						const next = useProjectStore.getState().document?.zoomRanges.at(-1);
						if (next) {
							tl.selectRegion("zoom", next.id);
							useZoomTarget.getState().select(next.id);
						}
					}}
				>
					Zoom Here
				</button>
				<button type="button" onClick={onChyrons}>
					Label Section
				</button>
				<button
					type="button"
					onClick={() => {
						if (hasCamera) void tl.addCameraFullscreen(4);
						else toast.info("Select a clip with a linked camera recording.");
					}}
				>
					Show Me Full Screen
				</button>
				<button
					type="button"
					onClick={() => {
						if (hasCamera)
							void save(presenterToCorner(doc, useProjectStore.getState().currentTimeSec));
						else toast.info("Select a clip with a linked camera recording.");
					}}
				>
					Move Me to Corner
				</button>
				<button
					type="button"
					onClick={async () => {
						const next = tightenPauses(doc);
						const count = next.timeline.trimRanges.length - doc.timeline.trimRanges.length;
						if (!count) {
							toast.info(
								"No eligible silent pauses. Transcribe the footage first. Locked regions stay intact.",
							);
							return;
						}
						if (await save(next))
							toast.success(`Tightened ${count} silent pauses. Undo restores them.`);
					}}
				>
					Tighten Pauses
				</button>
				<button
					type="button"
					onClick={() => {
						if (undo()) afterHistory();
					}}
				>
					Undo
				</button>
				<button
					type="button"
					onClick={() => {
						if (redo()) afterHistory();
					}}
				>
					Redo
				</button>
			</div>
			{!studioFontStatus.ready && (
				<p className="pl-notice">Missing video fonts: {studioFontStatus.missing.join(", ")}</p>
			)}
			{demoOpen && (
				<div
					className="pl-pane"
					style={{
						position: "absolute",
						top: 100,
						left: 20,
						zIndex: 100,
						width: 390,
						maxHeight: "75%",
						background: "var(--surface)",
						border: "1px solid var(--border)",
						borderRadius: 12,
					}}
				>
					<h2>Make a Demo</h2>
					<label>
						Starting preset
						<select value={preset} onChange={(e) => setPreset(e.target.value)}>
							{["Product walkthrough", "Marketing highlight", "Quick tip"].map((p) => (
								<option key={p}>{p}</option>
							))}
						</select>
					</label>
					<label>
						Focus and instructions
						<textarea
							value={focus}
							onChange={(e) => setFocus(e.target.value)}
							placeholder="Describe the action or benefit shown in your footage."
						/>
					</label>
					<label>
						Target seconds
						<input
							type="number"
							min={10}
							max={3600}
							value={duration}
							onChange={(e) => setDuration(e.target.valueAsNumber)}
						/>
					</label>
					<p>
						Uses your configured AI provider and the current footage. You can restore the pre-edit
						checkpoint.
					</p>
					<div className="pl-row">
						<button
							type="button"
							onClick={() => {
								useChatPromptBus
									.getState()
									.submit(
										`Create a ${preset} from this project. Target approximately ${duration} seconds; retain coherence over exact duration. Focus: ${focus || "the instructional sequence visible in the actual footage"}. Read the project, transcript, and available cursor telemetry first. Preserve locked manual decisions. Do not invent product features, statistics, pricing, links, or scenes. Identify missing footage. Use restrained zooms, section chyrons where supported, and an editable closing CTA for a marketing highlight. Preserve meaningful explanations; remove only clear false starts or silence. Use validated tools only and summarize actual changes.`,
									);
								setDemoOpen(false);
							}}
						>
							Create edit
						</button>
						<button type="button" onClick={() => setDemoOpen(false)}>
							Close
						</button>
					</div>
				</div>
			)}
		</>
	);
}

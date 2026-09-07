import { useCallback, useEffect, useRef, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import { type CaptureArea, captureAreaSchema } from "@/lib/captureArea";
import styles from "./SourceSelector.module.css";

export function WindowAreaPicker({
	image,
	initialArea,
	detectArea,
	onApply,
	onCancel,
}: {
	image: string;
	initialArea?: CaptureArea | null;
	detectArea?: () => Promise<CaptureArea | null>;
	onApply: (area: CaptureArea) => void;
	onCancel: () => void;
}) {
	const t = useScopedT("launch");
	const [area, setArea] = useState<CaptureArea>(initialArea ?? { x: 0, y: 0, width: 1, height: 1 });
	const [edited, setEdited] = useState(!!initialArea);
	const [loaded, setLoaded] = useState(false);
	const [aspect, setAspect] = useState(16 / 9);
	const [detection, setDetection] = useState("pageAreaDetectIdle");
	const request = useRef(0);
	const detector = useRef(detectArea);
	const detect = useCallback(async () => {
		const id = ++request.current;
		setDetection("pageAreaDetecting");
		try {
			const result = await detector.current?.();
			if (id !== request.current) return;
			if (result && captureAreaSchema.safeParse(result).success) {
				setArea(result);
				setEdited(true);
				setDetection("pageAreaDetected");
			} else setDetection("pageAreaDetectFailed");
		} catch {
			if (id === request.current) setDetection("pageAreaDetectFailed");
		}
	}, []);
	useEffect(() => {
		if (!initialArea && detector.current) void detect();
		return () => {
			request.current++;
		};
	}, [detect, initialArea]);
	const start = useRef<{ x: number; y: number } | null>(null);
	const valid =
		loaded &&
		edited &&
		area.width >= 0.01 &&
		area.height >= 0.01 &&
		captureAreaSchema.safeParse(area).success;
	return (
		<div className={styles.areaPicker}>
			<h2>{t("sourceSelector.pageAreaTitle")}</h2>
			<p>{t("sourceSelector.pageAreaHelp")}</p>
			<div className={styles.areaWorkspace}>
				<div className={styles.areaCanvas}>
					<div
						className={styles.areaImage}
						style={{ width: `min(100%, calc((100dvh - 170px) * ${aspect}))` }}
						role="application"
						aria-label={t("sourceSelector.pageAreaTitle")}
						onPointerDown={(e) => {
							if (!loaded) return;
							request.current++;
							setDetection("pageAreaDetectIdle");
							const r = e.currentTarget.getBoundingClientRect();
							start.current = {
								x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
								y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
							};
							e.currentTarget.setPointerCapture(e.pointerId);
							setEdited(false);
						}}
						onPointerMove={(e) => {
							if (!start.current) return;
							const r = e.currentTarget.getBoundingClientRect();
							const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
							const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
							setArea({
								x: Math.min(x, start.current.x),
								y: Math.min(y, start.current.y),
								width: Math.abs(x - start.current.x),
								height: Math.abs(y - start.current.y),
							});
							setEdited(true);
						}}
						onPointerUp={(e) => {
							start.current = null;
							if (e.currentTarget.hasPointerCapture(e.pointerId))
								e.currentTarget.releasePointerCapture(e.pointerId);
						}}
						onPointerCancel={() => {
							start.current = null;
							setEdited(false);
						}}
					>
						<img
							src={image}
							alt={t("sourceSelector.pageAreaPreview")}
							draggable={false}
							onLoad={(e) => {
								setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 16 / 9);
								setLoaded(true);
							}}
							onError={() => setLoaded(false)}
						/>
						{edited && (
							<div
								className={styles.areaSelection}
								style={{
									left: `${area.x * 100}%`,
									top: `${area.y * 100}%`,
									width: `${area.width * 100}%`,
									height: `${area.height * 100}%`,
								}}
							/>
						)}
					</div>
				</div>
				<aside className={styles.areaControls}>
					{detectArea && (
						<>
							<button
								type="button"
								className={styles.detectButton}
								disabled={detection === "pageAreaDetecting"}
								onClick={() => void detect()}
							>
								{t("sourceSelector.pageAreaAuto")}
							</button>
							<p role="status">{t(`sourceSelector.${detection}`)}</p>
						</>
					)}
					<div className={styles.areaFields}>
						{(["x", "y", "width", "height"] as const).map((key) => (
							<label key={key}>
								{t(`sourceSelector.pageArea_${key}`)} (%)
								<input
									type="number"
									min={0}
									max={100}
									step={0.1}
									value={Math.round(area[key] * 1000) / 10}
									onChange={(e) => {
										request.current++;
										setDetection("pageAreaDetectIdle");
										setArea((a) => ({ ...a, [key]: Number(e.target.value) / 100 }));
										setEdited(true);
									}}
								/>
							</label>
						))}
					</div>
					<p>{t("sourceSelector.pageAreaSizeWarning")}</p>
					<div className={styles.areaActions}>
						<button type="button" onClick={onCancel}>
							{t("sourceSelector.pageAreaBack")}
						</button>
						<button
							type="button"
							disabled={!valid}
							onClick={() => onApply(captureAreaSchema.parse(area))}
						>
							{t("sourceSelector.pageAreaUse")}
						</button>
					</div>
				</aside>
			</div>
		</div>
	);
}

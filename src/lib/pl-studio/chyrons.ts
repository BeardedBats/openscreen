import { createId } from "../ai-edition/document/ids";
import type { AxcutAnnotationRegion, AxcutDocument } from "../ai-edition/schema";
import { anchorRegionsWithDerivedMs, resolvePillIds } from "../ai-edition/timeline/timelineMap";
import { type Chyron, type ChyronTemplate, chyronSchema } from "./schema";
import { PL_THEME } from "./theme";

export const CHYRON_TEMPLATES: {
	id: ChyronTemplate;
	title: string;
	headline: string;
	supporting: string;
}[] = [
	{ id: "presenter", title: "Presenter", headline: "Nick Pollack", supporting: "Pitcher List" },
	{
		id: "section",
		title: "Section",
		headline: "Find your next waiver-wire pickup",
		supporting: "",
	},
	{
		id: "metric",
		title: "Metric explainer",
		headline: "Process+",
		supporting: "Add your approved explanation",
	},
	{
		id: "instruction",
		title: "Instruction",
		headline: "Show only available players",
		supporting: "",
	},
	{
		id: "spotlight",
		title: "Feature spotlight",
		headline: "Your league. Your available players.",
		supporting: "",
	},
	{ id: "closing", title: "Closing CTA", headline: "Explore PL Pro", supporting: "" },
];

export function templateChyron(template: ChyronTemplate): Chyron {
	const item = CHYRON_TEMPLATES.find((t) => t.id === template) ?? CHYRON_TEMPLATES[1];
	return chyronSchema.parse({ template, headline: item.headline, supporting: item.supporting });
}

export function readingDuration(chyron: Chyron): number {
	return Math.max(
		4,
		(chyron.headline + " " + chyron.supporting).trim().split(/\s+/).length / 2.5 + 0.4,
	);
}

export function addChyron(
	doc: AxcutDocument,
	chyron: Chyron,
	startSec: number,
	duration = readingDuration(chyron),
): AxcutDocument {
	const end = Math.max(0, ...doc.timeline.clips.map((c) => c.timelineEndSec ?? 0));
	if (startSec >= end) throw new Error("Place the playhead inside a clip before adding a chyron.");
	const region: AxcutAnnotationRegion = {
		id: createId("chyron"),
		startMs: startSec * 1000,
		endMs: Math.min(end, startSec + duration) * 1000,
		type: "text",
		content: chyron.headline,
		chyron: chyronSchema.parse(chyron),
		position: { x: 5, y: 70 },
		size: {
			width: {
				presenter: 34,
				section: 55,
				metric: 42,
				instruction: 48,
				spotlight: 70,
				closing: 60,
			}[chyron.template],
			height: 20,
		},
		zIndex: 500,
		style: {
			color: PL_THEME.text,
			backgroundColor: "transparent",
			fontSize: 40,
			fontFamily: PL_THEME.headingFont,
			fontWeight: "bold",
			fontStyle: "normal",
			textDecoration: "none",
			textAlign: "left",
			textAnimation: "none",
		},
	};
	return {
		...doc,
		annotations: [
			...doc.annotations,
			...anchorRegionsWithDerivedMs([region], doc.timeline.clips, () => createId("chyron")),
		],
	};
}

export function replaceChyron(
	doc: AxcutDocument,
	id: string,
	patch: Partial<Chyron>,
): AxcutDocument {
	const ids = new Set(resolvePillIds(doc.annotations, id));
	return {
		...doc,
		annotations: doc.annotations.map((a) => {
			if (!ids.has(a.id) || !a.chyron) return a;
			const chyron = chyronSchema.parse({ ...a.chyron, ...patch });
			return { ...a, chyron, content: chyron.headline };
		}),
	};
}

/** Timeline-based envelope, shared by the library preview and the native contract. */
export function chyronMotion(chyron: Chyron, elapsedMs: number, durationMs: number) {
	const ease = (v: number) => 1 - (1 - Math.min(1, Math.max(0, v))) ** 3;
	const entering = chyron.entry === "cut" ? 1 : ease(elapsedMs / chyron.entryMs);
	const leaving = chyron.exit === "cut" ? 1 : ease((durationMs - elapsedMs) / chyron.exitMs);
	return {
		opacity: elapsedMs < 0 || elapsedMs >= durationMs ? 0 : Math.min(entering, leaving),
		x:
			(chyron.entry === "slide" ? -18 * (1 - entering) : 0) +
			(chyron.exit === "slide" ? 18 * (1 - leaving) : 0),
		reveal: Math.min(
			chyron.entry === "reveal" ? entering : 1,
			chyron.exit === "reveal" ? leaving : 1,
		),
	};
}

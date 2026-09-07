import { z } from "zod";

export const chyronTemplateSchema = z.enum([
	"presenter",
	"section",
	"metric",
	"instruction",
	"spotlight",
	"closing",
]);
export const chyronVariantSchema = z.enum(["editorial", "soft-panel", "spotlight"]);
const color = z.string().regex(/^#[\da-fA-F]{6}$/);
/** Additive, versioned payload on an ordinary clip-anchored annotation. */
export const chyronSchema = z.object({
	version: z.literal(1).default(1),
	template: chyronTemplateSchema.default("section"),
	variant: chyronVariantSchema.default("editorial"),
	headline: z.string().max(2000).default("Label this section"),
	supporting: z.string().max(4000).default(""),
	headlineSize: z.number().min(24).max(160).default(40),
	supportingSize: z.number().min(18).max(100).default(28),
	align: z.enum(["left", "center", "right"]).default("left"),
	padding: z.number().min(8).max(100).default(28),
	color: color.default("#f2f7fc"),
	supportingColor: color.default("#b8cadb"),
	panelColor: color.default("#112337"),
	panelOpacity: z.number().min(0).max(1).default(0.94),
	entry: z.enum(["slide", "fade", "reveal", "cut"]).default("slide"),
	exit: z.enum(["slide", "fade", "reveal", "cut"]).default("fade"),
	entryMs: z.number().min(50).max(1500).default(220),
	exitMs: z.number().min(50).max(1500).default(180),
	locked: z.boolean().default(false),
});
export type Chyron = z.infer<typeof chyronSchema>;
export type ChyronTemplate = z.infer<typeof chyronTemplateSchema>;
export type ChyronVariant = z.infer<typeof chyronVariantSchema>;

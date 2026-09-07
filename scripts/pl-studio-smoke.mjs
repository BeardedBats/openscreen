import fs from "node:fs";
import path from "node:path";
import { _electron as electron } from "@playwright/test";

const root = process.cwd();
const out = path.join(root, "artifacts/pl-studio");
const env = {
	...process.env,
	ELECTRON_USER_DATA_DIR: path.join(out, "test-user-data"),
	VITE_DEV_SERVER_URL: "http://127.0.0.1:5173/",
	OPENSCREEN_DISABLE_CONTENT_PROTECTION: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
	args: [path.join(root, "dist-electron/main.js")],
	env,
	timeout: 60000,
});
app.process().stderr?.on("data", (d) => fs.appendFileSync(path.join(out, "electron.log"), d));
try {
	const hud = await app.firstWindow();
	await hud.waitForLoadState("domcontentloaded");
	await hud.evaluate(() => window.electronAPI.switchToEditor());
	let page;
	for (let n = 0; n < 30; n++) {
		page = app.windows().find((p) => p.url().includes("windowType=editor"));
		if (page) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	if (!page) throw Error("No editor window");
	await page.waitForLoadState("domcontentloaded");
	await page.setViewportSize({ width: 1600, height: 1000 });
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.waitForSelector("button", { timeout: 30000 });
	const result = await page.evaluate(
		async ({ root, out }) => {
			const storeUrl = performance
				.getEntriesByType("resource")
				.map((r) => r.name)
				.filter((n) => n.includes("/src/lib/ai-edition/store/projectStore.ts"))
				.at(-1);
			const { useProjectStore } = await import(
				storeUrl || "/src/lib/ai-edition/store/projectStore.ts"
			);
			const { documentSchema } = await import("/src/lib/ai-edition/schema/index.ts");
			const { addChyron, templateChyron } = await import("/src/lib/pl-studio/chyrons.ts");
			const { presenterToCorner } = await import("/src/lib/pl-studio/layouts.ts");
			const { studioFontStatus } = await import("/src/lib/pl-studio/fonts.ts");
			window.__plStore = useProjectStore;
			let doc = await useProjectStore.getState().createProject("PL Studio — sample workflow");
			doc = documentSchema.parse({
				...doc,
				assets: [
					{
						id: "sample",
						kind: "video",
						label: "Sample dashboard — not live data",
						originalPath: out + "/dashboard-narrated.mp4",
						durationSec: 12,
						video: { width: 1920, height: 1080, fps: 25, codec: "h264" },
						cameraTrack: {
							sourcePath: out + "/presenter.mp4",
							startMs: 0,
							offsetMs: 0,
							visible: true,
							width: 1280,
							height: 720,
						},
					},
				],
				timeline: {
					clips: [
						{
							id: "sample-clip",
							assetId: "sample",
							sourceStartSec: 0,
							sourceEndSec: 12,
							timelineStartSec: 0,
							timelineEndSec: 12,
							origin: "user",
						},
					],
				},
			});
			doc = presenterToCorner(doc, 4);
			for (const [i, template] of ["presenter", "section", "closing"].entries())
				doc = addChyron(
					doc,
					{
						...templateChyron(template),
						variant: ["soft-panel", "editorial", "spotlight"][i],
						headline:
							template === "section"
								? "Sample: review available players"
								: templateChyron(template).headline,
					},
					i * 4,
					4,
				);
			if (!(await useProjectStore.getState().saveDocument(doc, { history: true })))
				throw Error("Save failed");
			useProjectStore.getState().setCurrentTime(7);
			return { id: doc.project.id, fontStatus: studioFontStatus };
		},
		{ root, out: out.replaceAll("\\", "/") },
	);
	console.log(JSON.stringify(result));
	await page.waitForFunction(
		() => window.__plStore.getState().document?.transcripts?.length > 0,
		{},
		{ timeout: 60000 },
	);
	await page.getByRole("button", { name: "Add Captions", exact: true }).click();
	await page.waitForTimeout(500);
	const beforeCorrection = await page.evaluate(() =>
		JSON.stringify(window.__plStore.getState().document.timeline),
	);
	const word = page
		.locator("[data-word-id]")
		.filter({ hasText: /picture/i })
		.first();
	console.log(await page.locator("[data-word-id]").allTextContents());
	await word.dblclick();
	await page.locator('input[data-word-editor="true"]').fill("Pitcher");
	await page.locator('input[data-word-editor="true"]').press("Enter");
	await page.waitForTimeout(300);
	if (
		(await page.evaluate(() => JSON.stringify(window.__plStore.getState().document.timeline))) !==
		beforeCorrection
	)
		throw Error("Spelling correction changed the timeline");
	await page.getByRole("button", { name: "Zoom Here", exact: true }).click();
	const target = page.getByRole("application", { name: "Draw zoom target" });
	await target.waitFor();
	const bounds = await target.boundingBox();
	await page.mouse.move(bounds.x + bounds.width * 0.05, bounds.y + bounds.height * 0.1);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width * 0.78, bounds.y + bounds.height * 0.65, {
		steps: 8,
	});
	await page.mouse.up();
	await page.waitForTimeout(300);
	const zoom = await page.evaluate(() => window.__plStore.getState().document.zoomRanges.at(-1));
	if (!zoom.locked || zoom.customScale <= 1) throw Error("Drawn zoom did not persist");
	await page.getByRole("button", { name: "Undo", exact: true }).click();
	await page.waitForTimeout(200);
	if (await page.evaluate(() => window.__plStore.getState().document.zoomRanges.at(-1)?.locked))
		throw Error("Undo failed");
	await page.getByRole("button", { name: "Redo", exact: true }).click();
	await page.waitForTimeout(200);
	if (!(await page.evaluate(() => window.__plStore.getState().document.zoomRanges.at(-1)?.locked)))
		throw Error("Redo failed");
	await page.evaluate(async () => {
		const native = await import("/src/native/nativeCompositorStore.ts");
		window.__plStore.getState().setCurrentTime(7);
		native.setNativeTime(7);
	});
	await page.waitForTimeout(1000);
	await page.screenshot({ path: path.join(out, "editor.png") });
	await page.getByRole("button", { name: "Label Section", exact: true }).click();
	await page.waitForTimeout(700);
	await page.screenshot({ path: path.join(out, "chyrons.png") });
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.waitForTimeout(300);
	await page.screenshot({ path: path.join(out, "editor-1280.png") });
	await page.setViewportSize({ width: 1600, height: 1000 });
	const exported = await page.evaluate(
		async ({ out }) => {
			const storeUrl = performance
				.getEntriesByType("resource")
				.map((r) => r.name)
				.filter((n) => n.includes("/src/lib/ai-edition/store/projectStore.ts"))
				.at(-1);
			const { useProjectStore } = await import(storeUrl);
			const { buildSceneDescription } = await import("/src/native/sceneDescription.ts");
			const { exportMultiNative } = await import("/src/native/compositorViewClient.ts");
			const doc = useProjectStore.getState().document;
			const scene = buildSceneDescription(doc);
			const stats = await exportMultiNative(
				[
					{
						screenPath: out + "/dashboard-narrated.mp4",
						webcamPath: out + "/presenter.mp4",
						sourceStartSec: 0,
						sourceEndSec: 12,
						webcamOffsetSec: 0,
						hasAudio: true,
					},
				],
				out + "/sample-export.mp4",
				JSON.stringify(scene),
				{ width: 1920, height: 1080, fps: 30, codec: "h264" },
			);
			await useProjectStore.getState().loadProject(doc.project.id);
			return {
				stats,
				reopenedChyrons: useProjectStore.getState().document.annotations.length,
				document: doc,
			};
		},
		{ out: out.replaceAll("\\", "/") },
	);
	fs.writeFileSync(
		path.join(out, "sample-project.openscreen"),
		JSON.stringify(exported.document, null, 2),
	);
	delete exported.document;
	fs.writeFileSync(
		path.join(out, "verification.json"),
		JSON.stringify({ result, exported, errors }, null, 2),
	);
	console.log(JSON.stringify(exported));
} finally {
	await app.close();
}

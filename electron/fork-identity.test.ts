import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: true, getVersion: () => "1.10.0" } }));
vi.mock("electron-updater", () => {
	throw new Error("A personal build must never load the upstream updater");
});

import { checkForSelfUpdate, downloadSelfUpdate, installSelfUpdate } from "./auto-updater";
import { FORK_UPDATES_ENABLED } from "./fork-identity";

describe("personal fork updates", () => {
	it("refuses checks, downloads and installs without loading an updater", async () => {
		expect(FORK_UPDATES_ENABLED).toBe(false);
		expect(await checkForSelfUpdate("nsis")).toEqual({ kind: "unsupported" });
		expect(await downloadSelfUpdate()).toEqual({ kind: "unsupported" });
		await expect(installSelfUpdate()).resolves.toBeUndefined();
	});
});

import { beforeEach, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: execute }));

import { detectBrowserCaptureArea } from "./captureArea";

beforeEach(() => {
	execute.mockReset();
});
it("rejects source identifiers that are not windows without invoking a helper", async () => {
	expect(await detectBrowserCaptureArea("helper", "screen:1:0")).toBeNull();
	expect(execute).not.toHaveBeenCalled();
});
it("uses a hidden bounded helper and validates its bounds", async () => {
	execute.mockImplementation((_file, _args, _options, callback) =>
		callback(null, JSON.stringify({ area: { x: 0, y: 0.2, width: 1, height: 0.8 } })),
	);
	expect(await detectBrowserCaptureArea("helper", "window:42:0")).toEqual({
		x: 0,
		y: 0.2,
		width: 1,
		height: 0.8,
	});
	expect(execute).toHaveBeenCalledWith(
		"helper",
		["--detect-browser-area", "42"],
		expect.objectContaining({ windowsHide: true, timeout: 6000 }),
		expect.any(Function),
	);
});
it("fails safely on invalid bounds and helper errors", async () => {
	execute.mockImplementation((_file, _args, _options, callback) =>
		callback(null, '{"area":{"x":0,"y":0.2,"width":1,"height":1}}'),
	);
	expect(await detectBrowserCaptureArea("helper", "window:42:0")).toBeNull();
	execute.mockImplementation((_file, _args, _options, callback) =>
		callback(new Error("timeout"), ""),
	);
	expect(await detectBrowserCaptureArea("helper", "window:42:0")).toBeNull();
});

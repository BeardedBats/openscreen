// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WindowAreaPicker } from "./WindowAreaPicker";

vi.mock("@/contexts/I18nContext", () => ({ useScopedT: () => (key: string) => key }));
it("requires a loaded preview and deliberate valid area before applying", () => {
	const onApply = vi.fn();
	render(
		<WindowAreaPicker image="data:image/png;base64,test" onApply={onApply} onCancel={vi.fn()} />,
	);
	const apply = screen.getByRole("button", { name: "sourceSelector.pageAreaUse" });
	expect(apply).toBeDisabled();
	fireEvent.load(screen.getByRole("img"));
	fireEvent.change(screen.getByLabelText(/pageArea_y/), { target: { value: "20" } });
	expect(apply).toBeDisabled();
	fireEvent.change(screen.getByLabelText(/pageArea_height/), { target: { value: "80" } });
	fireEvent.click(apply);
	expect(onApply).toHaveBeenCalledWith({ x: 0, y: 0.2, width: 1, height: 0.8 });
});

afterEach(cleanup);
it("detects on entry and applies the detected bounds after preview load", async () => {
	const area = { x: 0, y: 0.1, width: 0.98, height: 0.9 };
	const onApply = vi.fn();
	render(
		<WindowAreaPicker
			image="test"
			onApply={onApply}
			onCancel={vi.fn()}
			detectArea={async () => area}
		/>,
	);
	fireEvent.load(screen.getByRole("img"));
	await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("pageAreaDetected"));
	fireEvent.click(screen.getByRole("button", { name: "sourceSelector.pageAreaUse" }));
	expect(onApply).toHaveBeenCalledWith(area);
});
it("keeps manual changes when a stale detector response arrives", async () => {
	let resolve!: (value: { x: number; y: number; width: number; height: number }) => void;
	const pending = new Promise<{ x: number; y: number; width: number; height: number }>((r) => {
		resolve = r;
	});
	render(
		<WindowAreaPicker
			image="test"
			onApply={vi.fn()}
			onCancel={vi.fn()}
			detectArea={() => pending}
		/>,
	);
	fireEvent.load(screen.getByRole("img"));
	fireEvent.change(screen.getByLabelText(/pageArea_y/), { target: { value: "25" } });
	await act(async () => resolve({ x: 0, y: 0.1, width: 1, height: 0.9 }));
	expect(screen.getByLabelText(/pageArea_y/)).toHaveValue(25);
});
it("retains an existing crop when reopening", () => {
	const detectArea = vi.fn();
	render(
		<WindowAreaPicker
			image="test"
			initialArea={{ x: 0, y: 0.2, width: 1, height: 0.8 }}
			onApply={vi.fn()}
			onCancel={vi.fn()}
			detectArea={detectArea}
		/>,
	);
	expect(detectArea).not.toHaveBeenCalled();
	expect(screen.getByLabelText(/pageArea_y/)).toHaveValue(20);
});

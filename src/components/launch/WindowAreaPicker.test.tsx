// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
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

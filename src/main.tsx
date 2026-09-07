import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/I18nContext";
import { clearStaleSourceCache } from "./lib/exporter/localSourceFile";
import "./hooks/rendererConsoleForwarder";
import "./index.css";
import "./styles/pl-studio.css";
import { loadStudioFonts } from "./lib/pl-studio/fonts";

const windowType = new URLSearchParams(window.location.search).get("windowType") || "";

// Reclaim multi-GB OPFS source copies left behind by a previous session (they
// are only pruned opportunistically during the next large-file load otherwise).
// Nothing is referenced at startup, so everything stale is safe to remove.
if (!windowType) {
	window.setTimeout(() => {
		clearStaleSourceCache().catch(() => undefined);
	}, 5_000);
}
const showNotes = new URLSearchParams(window.location.search).get("showNotes") === "true";
if (
	showNotes ||
	windowType === "hud-overlay" ||
	windowType === "source-selector" ||
	windowType === "countdown-overlay"
) {
	document.body.style.background = "transparent";
	document.documentElement.style.background = "transparent";
	document.getElementById("root")?.style.setProperty("background", "transparent");
}

void loadStudioFonts().then(() =>
	ReactDOM.createRoot(document.getElementById("root")!).render(
		<React.StrictMode>
			<I18nProvider>
				<App />
			</I18nProvider>
		</React.StrictMode>,
	),
);

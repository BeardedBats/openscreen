import { execFile } from "node:child_process";
/** Old helpers reject this argument without opening a capture session. Never fall back to full-window capture. */
export async function requireCaptureAreaSupport(helper: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		execFile(
			helper,
			["--capabilities"],
			{ windowsHide: true, timeout: 5000, maxBuffer: 16384 },
			(error, stdout) => {
				try {
					if (!error && JSON.parse(stdout).captureArea === 1) {
						resolve();
						return;
					}
				} catch {
					/* Unsupported helper. */
				}
				reject(
					new Error(
						"Webpage-area recording needs the updated Windows capture helper. Rebuild or reinstall PL Demo Studio.",
					),
				);
			},
		);
	});
}

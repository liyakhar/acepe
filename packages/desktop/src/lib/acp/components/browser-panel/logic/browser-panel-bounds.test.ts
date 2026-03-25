import { describe, expect, it } from "bun:test";

import { resolveBrowserPanelBounds } from "./browser-panel-bounds.js";

describe("resolveBrowserPanelBounds", () => {
	it("uses zoom-aware viewport bounds relative to the main webview inset", async () => {
		const bounds = await resolveBrowserPanelBounds(
			{ x: 739.7869262695312, y: 62.596588134765625, width: 497.272705078125, height: 759.3323364257812 },
			{
				getWindowInnerPosition: async () => ({ x: 412, y: 96 }),
				getWebviewPosition: async () => ({ x: 412, y: 96 }),
				getScaleFactor: async () => 1,
				getZoomLevel: () => 0.8,
			}
		);

		expect(bounds.x).toBeCloseTo(739.7869262695, 10);
		expect(bounds.y).toBeCloseTo(62.5965881348, 10);
		expect(bounds.width).toBeCloseTo(497.2727050781, 10);
		expect(bounds.height).toBeCloseTo(759.3323364258, 10);
	});

	it("preserves header inset when the main webview is offset inside the window", async () => {
		const bounds = await resolveBrowserPanelBounds(
			{ x: 964, y: 138, width: 620, height: 1000 },
			{
				getWindowInnerPosition: async () => ({ x: 100, y: 80 }),
				getWebviewPosition: async () => ({ x: 124, y: 116 }),
				getScaleFactor: async () => 2,
				getZoomLevel: () => 1,
			}
		);

		expect(bounds).toEqual({
			x: 964,
			y: 138,
			width: 620,
			height: 1000,
		});
	});
});

export interface BrowserPanelBoundsDependencies {
	getWindowInnerPosition: () => Promise<{ x: number; y: number }>;
	getWebviewPosition: () => Promise<{ x: number; y: number }>;
	getScaleFactor: () => Promise<number>;
	getZoomLevel: () => number;
}

export interface BrowserPanelViewportRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BrowserPanelNativeBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export async function resolveBrowserPanelBounds(
	rect: BrowserPanelViewportRect,
	dependencies: BrowserPanelBoundsDependencies
): Promise<BrowserPanelNativeBounds> {
	void dependencies;

	return {
		x: rect.x,
		y: rect.y,
		width: rect.width,
		height: rect.height,
	};
}

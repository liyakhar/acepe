import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

function read(relativePath: string): string {
	return readFileSync(resolve(import.meta.dir, "..", relativePath), "utf8");
}

describe("layering contract", () => {
	it("defines a shared overlay z-index token in design tokens", () => {
		const designTokensSource = read("lib/design-tokens.css");

		expect(designTokensSource).toContain("--overlay-z: 50;");
	});

	it("uses the shared overlay z-index token across portaled shared surfaces", () => {
		const dialogContentSource = read("components/dialog/dialog-content.svelte");
		const dialogOverlaySource = read("components/dialog/dialog-overlay.svelte");
		const drawerContentSource = read("components/drawer/drawer-content.svelte");
		const drawerOverlaySource = read("components/drawer/drawer-overlay.svelte");
		const dropdownSubContentSource = read(
			"components/dropdown-menu/dropdown-menu-sub-content.svelte"
		);
		const statusIconSource = read("components/agent-panel/agent-panel-status-icon.svelte");
		const tabBarTooltipSource = read("components/app-layout/app-tab-bar-tab.svelte");

		for (const source of [
			dialogContentSource,
			dialogOverlaySource,
			drawerContentSource,
			drawerOverlaySource,
			dropdownSubContentSource,
			statusIconSource,
			tabBarTooltipSource,
		]) {
			expect(source).toContain("var(--overlay-z)");
		}
	});
});
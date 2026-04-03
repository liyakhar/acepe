import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "../permission-action-bar.svelte"), "utf8");

describe("permission action bar contract", () => {
	it("renders a compact permission summary above the buttons", () => {
		expect(source).toContain("projectPath?: string | null;");
		expect(source).toContain("extractCompactPermissionDisplay(permission, projectPath)");
		expect(source).toContain("{#if compact}");
		expect(source).toContain("compactDisplay.label");
		expect(source).toContain("compactDisplay.filePath");
		expect(source).toContain("compactDisplay.command");
	});
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "../permission-action-bar.svelte"), "utf8");

describe("permission action bar contract", () => {
	it("defines a shared permission summary that shells can show or hide", () => {
		expect(source).toContain("projectPath?: string | null;");
		expect(source).toContain("extractCompactPermissionDisplay(permission, projectPath)");
		expect(source).toContain("{#snippet permissionSummary()}");
		expect(source).toContain("{#if !hideHeader}");
		expect(source).toContain("{@render permissionSummary()}");
		expect(source).toContain("compactDisplay.label");
		expect(source).toContain("compactDisplay.filePath");
		expect(source).toContain("compactDisplay.command");
		expect(source).toContain("<FilePathBadge filePath={compactDisplay.filePath} interactive={false} />");
		expect(source).not.toContain('size="sm"');
	});

	it("keeps the action row right-aligned without stretching buttons", () => {
		expect(source).toContain('const buttonClass = "justify-center shrink-0";');
		expect(source).toContain('<div class="flex items-center justify-end gap-1"');
		expect(source).not.toContain("flex-1 justify-center");
	});

	it("orders buttons so allow stays on the far right", () => {
		const denyIndex = source.indexOf("m.permission_deny()");
		const alwaysIndex = source.indexOf("m.permission_always_allow()");
		const allowIndex = source.indexOf("m.permission_allow()");

		expect(denyIndex).toBeGreaterThan(-1);
		expect(alwaysIndex).toBeGreaterThan(denyIndex);
		expect(allowIndex).toBeGreaterThan(alwaysIndex);
	});
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "../permission-bar.svelte"), "utf8");

describe("permission bar contract", () => {
	it("keeps the file chip wrapper clickable", () => {
		expect(source).toContain('<div class="min-w-0 flex-1 cursor-pointer">');
		expect(source).toContain("<FilePathBadge {filePath} interactive={false} />");
		expect(source).not.toContain('size="sm"');
	});

	it("derives session-bar visibility through the shared helper", () => {
		expect(source).toContain("visiblePermissionsForSessionBar");
	});

	it("suppresses the echoed command preview when the permission is already represented by a tool call", () => {
		expect(source).toContain("isPermissionRepresentedByToolCall");
		expect(source).toContain("@const command = isRepresentedByToolCall ? null : compactDisplay.command");
	});

	it("renders the permission summary above a dedicated action row", () => {
		expect(source).toContain(
			'class="w-full flex flex-col gap-1.5 px-3 py-1 rounded-md border border-border bg-muted/30 permission-card-enter'
		);
		expect(source).toContain('<div class="flex w-full items-start justify-between gap-1.5">');
		expect(source).toContain("<PermissionActionBar permission={currentPermission} hideHeader />");
		expect(source).not.toContain("<PermissionActionBar permission={currentPermission} inline hideHeader />");
		expect(source).toContain("<VoiceDownloadProgress");
		expect(source).toContain('class="permission-tally-bar flex shrink-0 items-center self-center"');
		expect(source).toContain('<div class="flex w-full items-center">');
	});

	it("matches the shared header chrome instead of using a custom inset card skin", () => {
		expect(source).toContain('<div class="w-full">');
		expect(source).toContain('rounded-md border border-border bg-muted/30');
	});

	it("does not cap the permission toolbar width", () => {
		expect(source).not.toContain("max-w-[320px]");
	});

	it("removes the divider before the tally bar", () => {
		expect(source).not.toContain("HeaderActionCell");
	});
});

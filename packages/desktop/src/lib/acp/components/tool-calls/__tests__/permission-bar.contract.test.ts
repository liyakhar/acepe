import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "../permission-bar.svelte"), "utf8");

describe("permission bar contract", () => {
	it("keeps the file chip wrapper clickable", () => {
		expect(source).toContain('<div class="min-w-0 flex-1 cursor-pointer">');
		expect(source).toContain("<FilePathBadge {filePath} interactive={false} size=\"sm\" />");
	});

	it("filters out permissions already represented by tool-call entries", () => {
		expect(source).toContain("visiblePermissionsForSessionBar");
	});
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "../tool-call-router.svelte"), "utf8");

describe("tool call router permission contract", () => {
	it("renders an inline permission action bar for anchored permissions", () => {
		expect(source).toContain('import PermissionActionBar from "./permission-action-bar.svelte";');
		expect(source).toContain("<PermissionActionBar permission={pendingPermission} inline hideHeader />");
	});
});

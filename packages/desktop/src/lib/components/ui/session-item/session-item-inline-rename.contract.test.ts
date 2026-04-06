import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sessionItemPath = resolve(__dirname, "./session-item.svelte");
const source = readFileSync(sessionItemPath, "utf8");

describe("session item inline rename", () => {
	it("uses an inline input instead of a dialog", () => {
		expect(source).toContain('import { Input } from "$lib/components/ui/input/index.js";');
		expect(source).toContain("let isRenaming = $state(false);");
		expect(source).toContain('aria-label="Rename session"');
		expect(source).toContain("!text-xs");
		expect(source).toContain("md:!text-xs");
		expect(source).toContain("onkeydown={handleRenameKeydown}");
		expect(source).toContain("onblur={submitRename}");
		expect(source).not.toContain("Dialog.");
	});

	it("exposes rename from the session actions menu", () => {
		expect(source).toContain("onSelect={openRenameEditor}");
	});
});

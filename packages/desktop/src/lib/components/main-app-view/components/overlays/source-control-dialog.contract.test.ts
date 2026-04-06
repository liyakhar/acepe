import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceControlDialogPath = resolve(__dirname, "./source-control-dialog.svelte");
const source = readFileSync(sourceControlDialogPath, "utf8");

describe("SourceControlDialog", () => {
	it("gives the embedded git panel a real viewport height", () => {
		expect(source).toContain('class="flex h-[90vh] w-fit max-w-[96vw]');
		expect(source).toContain('class="h-full w-[min(1100px,96vw)]');
	});
});

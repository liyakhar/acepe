import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const toolTallyPath = resolve(import.meta.dir, "./tool-tally.svelte");

describe("tool tally contract", () => {
	it("supports a compact non-inline tally strip for dense surfaces", () => {
		expect(existsSync(toolTallyPath)).toBe(true);
		if (!existsSync(toolTallyPath)) return;

		const source = readFileSync(toolTallyPath, "utf8");

		expect(source).toContain("compact?: boolean;");
		expect(source).toContain(
			'class="flex items-center gap-[2px] {isInline ? \'\' : props.compact ? \'border-t border-border/60 px-1 pt-0.5 pb-1\' : \'border-t border-border px-2 py-1.5\'}"'
		);
		expect(source).toContain(
			'class="rounded-full {isInline ? \'h-1.5 w-[5px]\' : props.compact ? \'h-1.5 w-[2px]\' : \'h-2 w-[3px]\'}"'
		);
	});
});

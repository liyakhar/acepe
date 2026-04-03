import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const agentToolTaskPath = resolve(import.meta.dir, "./agent-tool-task.svelte");
const source = readFileSync(agentToolTaskPath, "utf8");

describe("agent tool task contract", () => {
	it("supports a compact variant for dense surfaces like kanban cards", () => {
		expect(source).toContain("compact?: boolean;");
		expect(source).toContain("compact = false");
		expect(source).toContain("const cardClass = $derived(compact ?");
			expect(source).toContain("const headerClass = $derived(compact");
			expect(source).toContain("const rowSectionClass = $derived(compact");
		expect(source).toContain("const tallyInline = $derived(compact);");
		expect(source).not.toContain("border-border/60 p-1");
		expect(source).toContain("const showLiveToolRow = $derived(!compact && hasChildren && lastToolCall !== null);");
		expect(source).toContain("{#if showLiveToolRow && lastToolCall}");
		expect(source).not.toContain("{#if hasChildren && lastToolCall}");
	});
});
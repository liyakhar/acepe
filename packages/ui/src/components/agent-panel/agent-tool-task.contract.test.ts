import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const agentToolTaskPath = resolve(import.meta.dir, "./agent-tool-task.svelte");
const source = readFileSync(agentToolTaskPath, "utf8");

describe("agent tool task contract", () => {
	it("supports a compact variant for dense surfaces like kanban cards", () => {
		expect(source).toContain("compact?: boolean;");
		expect(source).toContain("compact = false");
		expect(source).toContain("children?: readonly AnyAgentEntry[];");
		expect(source).toContain("const taskChildren = $derived(Array.from(children));");
		expect(source).toContain("const cardClass = $derived(compact ?");
		expect(source).toContain(
			'const headerClass = $derived(compact\n\t\t? "flex min-w-0 items-center justify-between gap-1 px-1 py-0.5 text-[10px]"'
		);
		expect(source).toContain(
			'const headerContentClass = $derived(compact\n\t\t? "flex min-w-0 flex-1 items-center justify-start gap-1"'
		);
		expect(source).toContain(
			'const promptButtonClass = $derived(compact\n\t\t? "w-full flex items-center gap-1 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors border-none bg-transparent cursor-pointer"'
		);
		expect(source).toContain('const promptBodyClass = $derived(compact ? "px-1 pb-0.5" : "px-3 pb-2");');
		expect(source).toContain(
			'const resultButtonClass = $derived(compact\n\t\t? "w-full flex items-center gap-1 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors border-none bg-transparent cursor-pointer"'
		);
		expect(source).toContain('const resultBodyClass = $derived(compact ? "px-1 pb-1" : "px-3 pb-3");');
		expect(source).toContain(
			'const resultContentClass = $derived(compact\n\t\t? "text-[10px] bg-muted/30 rounded-sm p-1 whitespace-pre-wrap break-words leading-relaxed"'
		);
		expect(source).toContain('const rowSectionClass = $derived(compact ? "border-t border-border/60 py-0.5" : "border-t border-border py-1.5");');
		expect(source).toContain('dataTestid="agent-tool-task-card"');
		expect(source).toContain("const tallyInline = $derived(false);");
		expect(source).not.toContain("border-border/60 p-1");
		expect(source).toContain("const showLiveToolRow = $derived(!compact && hasChildren && lastToolCall !== null);");
		expect(source).toContain("{#if showLiveToolRow && lastToolCall}");
		expect(source).not.toContain("{#if hasChildren && lastToolCall}");
		expect(source).toContain("<ToolTally toolCalls={toolCallChildren} inline={tallyInline} compact={compact} />");
	});
});

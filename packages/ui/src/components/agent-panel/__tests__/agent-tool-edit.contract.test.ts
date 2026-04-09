import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentToolEditPath = resolve(import.meta.dir, "../agent-tool-edit.svelte");
const agentToolEditDiffPath = resolve(import.meta.dir, "../agent-tool-edit-diff.svelte");

const agentToolEditSource = readFileSync(agentToolEditPath, "utf8");
const agentToolEditDiffSource = readFileSync(agentToolEditDiffPath, "utf8");

describe("agent tool edit contract", () => {
	it("renders one Pierre diff per resolved edit entry", () => {
		expect(agentToolEditSource).toContain("diffs?: readonly AgentToolEditDiffEntry[];");
		expect(agentToolEditSource).toContain("const resolvedDiffs = $derived.by(() =>");
		expect(agentToolEditSource).toContain("{#each resolvedDiffs as diff, index");
		expect(agentToolEditSource).toContain(`diff.filePath ?? \`edit-\${index}\``);
	});

	it("keeps Pierre rendering active while edits are still streaming", () => {
		expect(agentToolEditDiffSource).not.toContain("{#if isStreaming && newString}");
		expect(agentToolEditDiffSource).not.toContain("if (streaming || !container || !diff)");
		expect(agentToolEditDiffSource).toContain("if (!container || !diff)");
	});

	it("renders the edit diff without Pierre line numbers", () => {
		expect(agentToolEditDiffSource).toContain("disableLineNumbers: true");
	});
});

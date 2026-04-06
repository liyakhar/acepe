import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const agentInputDir = import.meta.dir;

function read(relativePath: string): string {
	return readFileSync(resolve(agentInputDir, relativePath), "utf8");
}

describe("agent input autonomous contract", () => {
	it("keeps a provisional autonomous selection before the session exists", () => {
		const source = read("./agent-input-ui.svelte");

		expect(source).toContain("let provisionalAutonomousEnabled = $state(false);");
		expect(source).toContain(
			"sessionHotState ? sessionHotState.autonomousEnabled : provisionalAutonomousEnabled"
		);
		expect(source).toContain("provisionalAutonomousEnabled = !provisionalAutonomousEnabled;");
		expect(source).not.toContain("if (!props.sessionId) {\n\t\treturn true;\n\t}");
	});

	it("forwards the provisional autonomous selection into the first send", () => {
		const source = read("./agent-input-ui.svelte");

		expect(source).toContain(
			"initialAutonomousEnabled: provisionalAutonomousEnabled"
		);
	});
});

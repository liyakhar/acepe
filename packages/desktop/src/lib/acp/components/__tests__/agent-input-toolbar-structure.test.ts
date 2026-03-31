import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentInputPath = resolve(__dirname, "../agent-input/agent-input-ui.svelte");
const agentInputSource = readFileSync(agentInputPath, "utf8");

describe("agent input toolbar structure", () => {
	it("renders toolbar config options through the shared config selector", () => {
		expect(agentInputSource).toContain("ConfigOptionSelector");
		expect(agentInputSource).toContain("toolbarConfigOptions");
		expect(agentInputSource).toContain("handleConfigOptionChange");
		expect(agentInputSource).toContain("sessionStore.setConfigOption");
	});

	it("renders the Autonomous toggle through the shared toolbar cluster", () => {
		expect(agentInputSource).toContain("AutonomousToggleButton");
		expect(agentInputSource).toContain("handleAutonomousToggle");
		expect(agentInputSource).toContain("sessionStore.setAutonomousEnabled");
	});
});
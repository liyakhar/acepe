import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configOptionSelectorPath = resolve(__dirname, "../config-option-selector.svelte");
const configOptionSelectorSource = readFileSync(configOptionSelectorPath, "utf8");

describe("config option selector reasoning icon contract", () => {
	it("uses a brain icon for reasoning controls and keeps lightning for fast mode", () => {
		expect(configOptionSelectorSource).toContain('import Brain from "phosphor-svelte/lib/Brain";');
		expect(configOptionSelectorSource).toContain("{#if isReasoningConfigOption}");
		expect(configOptionSelectorSource).toContain("<Brain");
		expect(configOptionSelectorSource).toContain("{:else if isFastConfigOption}");
		expect(configOptionSelectorSource).toContain("<Lightning");
	});
});

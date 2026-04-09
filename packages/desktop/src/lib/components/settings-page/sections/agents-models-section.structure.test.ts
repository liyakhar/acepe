import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sectionPath = resolve(__dirname, "./agents-models-section.svelte");
const sectionSource = readFileSync(sectionPath, "utf8");
const logicPath = resolve(__dirname, "./agents-models-section.logic.ts");
const logicSource = readFileSync(logicPath, "utf8");

describe("agents-models-section structure", () => {
	it("renders default-model rows from provider metadata instead of built-in agent lists", () => {
		expect(sectionSource).not.toContain("AGENTS_WITH_MODEL_DEFAULTS");
		expect(sectionSource).toContain("getCachedModelsDisplay");
		expect(logicSource).toContain("supportsModelDefaults");
		expect(logicSource).toContain("displayOrder");
	});
});

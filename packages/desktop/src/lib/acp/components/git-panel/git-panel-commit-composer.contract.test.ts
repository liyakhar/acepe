import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dir, "./git-panel.svelte"), "utf8");

describe("GitPanel commit composer wiring", () => {
	it("passes the mic-enabled commit composer slot into the shared git layout", () => {
		expect(source).toContain("import MicButton");
		expect(source).toContain("{#snippet commitMicButton()}");
		expect(source).toContain("commitMicButton={commitMicButton}");
	});
});

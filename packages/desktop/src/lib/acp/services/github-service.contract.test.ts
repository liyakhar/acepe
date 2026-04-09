import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const serviceSource = readFileSync(resolve(import.meta.dir, "./github-service.ts"), "utf8");
const tauriLibSource = readFileSync(resolve(import.meta.dir, "../../../../src-tauri/src/lib.rs"), "utf8");

describe("github working file diff contract", () => {
	it("keeps the frontend command invocation aligned with the Tauri registry", () => {
		expect(serviceSource).toContain("Commands.github.git_working_file_diff");
		expect(tauriLibSource).toContain("git_working_file_diff");
	});
});

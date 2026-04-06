import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const cargoTomlPath = resolve(import.meta.dir, "../src-tauri/Cargo.toml");
const source = readFileSync(cargoTomlPath, "utf8");

describe("whisper feature gating contract", () => {
	it("keeps Metal off by default and adds it from the macOS target dependency", () => {
		expect(source).toContain("default = []");
		expect(source).not.toContain('default = ["whisper-metal"]');
		expect(source).toContain('[target.\'cfg(target_os = "macos")\'.dependencies]');
		expect(source).toContain('whisper-rs = { version = "=0.16.0", features = ["metal"] }');
		expect(source).toContain('whisper-metal = ["whisper-rs/metal"]');
	});
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

describe("app font theme", () => {
	it("exports Acepe font tokens through the Tailwind theme block", () => {
		const source = readFileSync(new URL("./app.css", import.meta.url), "utf8");

		expect(source).toContain('--font-sans: var(--font-sans);');
		expect(source).toContain('--font-serif: var(--font-serif);');
		expect(source).toContain('--font-mono: var(--font-mono);');
	});
});

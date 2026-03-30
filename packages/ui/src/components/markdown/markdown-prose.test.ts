import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./markdown-prose.css"), "utf8");

describe("markdown prose styles", () => {
	it("adds bottom room below scrollable tables", () => {
		expect(source).toContain(".markdown-content .table-wrapper");
		expect(source).toContain("padding-bottom: 0.5rem !important;");
	});
});
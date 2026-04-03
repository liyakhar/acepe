import { describe, expect, it } from "bun:test";

import { getIconBasePath } from "./icon-context.js";

describe("getIconBasePath", () => {
	it("defaults shared ui file icons to the svg icon directory", () => {
		expect(getIconBasePath()).toBe("/svgs/icons");
	});
});
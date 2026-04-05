import { describe, expect, it } from "bun:test";

import { buttonVariants } from "./variants.js";

describe("button variant contract", () => {
	it("adds a shared header-action button variant for compact toolbar actions", () => {
		const classes = buttonVariants({ variant: "headerAction", size: "headerAction" });

		expect(classes).toContain("px-2");
		expect(classes).toContain("py-0.5");
		expect(classes).toContain("text-[0.6875rem]");
		expect(classes).toContain("rounded");
		expect(classes).toContain("border");
		expect(classes).toContain("border-border/50");
		expect(classes).toContain("bg-muted");
		expect(classes).toContain("text-foreground/80");
		expect(classes).toContain("hover:bg-muted/80");
	});
});

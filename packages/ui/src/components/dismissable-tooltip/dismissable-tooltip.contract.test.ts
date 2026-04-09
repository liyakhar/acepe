import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./dismissable-tooltip.svelte"), "utf8");

describe("dismissable-tooltip contract", () => {
	it("renders only children when dismissed is true", () => {
		expect(source).toContain("{#if dismissed}");
		expect(source).toContain("{@render children()}");
	});

	it("renders a local positioned tooltip shell when not dismissed", () => {
		expect(source).toContain('class={`relative ${triggerClass}`}');
		expect(source).toContain("{#if open}");
		expect(source).toContain("absolute z-[var(--overlay-z)]");
	});

	it("opens only from pointer movement on the explicit trigger wrapper", () => {
		expect(source).toContain("onpointermove={requestOpen}");
		expect(source).toContain("onpointerleave={requestClose}");
		expect(source).not.toContain("TooltipPrimitive");
	});

	it("keeps the tooltip enterable and dismissable", () => {
		expect(source).toContain("onpointerenter={cancelClose}");
		expect(source).toContain("onpointerleave={requestClose}");
		expect(source).toContain("function getContentOffsetStyle");
		expect(source).toContain('aria-label="Dismiss this tip"');
		expect(source).toContain("onclick={handleDismiss}");
	});
});

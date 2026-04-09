import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";

const source = readFileSync(resolve(import.meta.dir, "./dismissable-tooltip.svelte"), "utf8");

describe("dismissable-tooltip contract", () => {
	it("removes the trigger entirely when dismissed is true", () => {
		expect(source).toContain("{#if !dismissed}");
		expect(source).not.toContain("{#if dismissed}");
	});

	it("renders a fixed-position tooltip shell when not dismissed", () => {
		expect(source).toContain("bind:this={triggerElement}");
		expect(source).toContain("{#if open}");
		expect(source).toContain("use:portalToBody");
		expect(source).toContain("fixed z-[9999]");
		expect(source).toContain("w-56");
	});

	it("opens only from mouse hover on the explicit trigger wrapper", () => {
		expect(source).toContain("onmouseover={requestOpen}");
		expect(source).toContain("onmouseleave={handleTriggerMouseleave}");
		expect(source).not.toContain("TooltipPrimitive");
	});

	it("keeps the tooltip enterable and dismissable", () => {
		expect(source).toContain("bind:this={contentElement}");
		expect(source).toContain("onmouseenter={cancelClose}");
		expect(source).toContain("onmouseleave={handleContentMouseleave}");
		expect(source).toContain("event.relatedTarget instanceof Node");
		expect(source).toContain("function updateContentPosition()");
		expect(source).toContain('aria-label="Dismiss this tip"');
		expect(source).toContain("onclick={handleDismiss}");
	});
});

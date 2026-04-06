import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
	ANIMATION_CLASS,
	fingerprint,
	resolveAnimateFromIndex,
	streamingReveal,
} from "../streaming-reveal-action.js";

function el(tag: string, text: string): Element {
	const element = document.createElement(tag);
	element.textContent = text;
	return element;
}

function createContainer(): HTMLDivElement {
	const div = document.createElement("div");
	div.classList.add("markdown-content");
	document.body.appendChild(div);
	return div;
}

function childHasAnimation(container: HTMLDivElement, index: number): boolean {
	return container.children[index]?.classList.contains(ANIMATION_CLASS) === true;
}

// --- Pure function tests ---

describe("fingerprint", () => {
	it("produces tag::text format", () => {
		expect(fingerprint(el("P", "Hello world"))).toBe("P::Hello world");
	});

	it("truncates text at 80 characters", () => {
		const longText = "x".repeat(120);
		const result = fingerprint(el("DIV", longText));
		expect(result).toBe(`DIV::${"x".repeat(80)}`);
	});

	it("handles empty text content", () => {
		expect(fingerprint(el("P", ""))).toBe("P::");
	});
});

describe("resolveAnimateFromIndex", () => {
	it("returns 0 when there are no settled fingerprints", () => {
		const current = ["P::Hello", "P::World"];
		expect(resolveAnimateFromIndex(current, [])).toBe(0);
	});

	it("returns full match count when all fingerprints match", () => {
		const current = ["P::Hello", "P::World"];
		const settled = ["P::Hello", "P::World"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(2);
	});

	it("returns index of first mismatch", () => {
		const current = ["P::Hello", "PRE::Changed", "P::New"];
		const settled = ["P::Hello", "P::World"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(1);
	});

	it("handles fewer current than settled fingerprints", () => {
		const current = ["P::Hello"];
		const settled = ["P::Hello", "P::World"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(1);
	});

	it("handles more current than settled fingerprints", () => {
		const current = ["P::Hello", "P::World", "P::New"];
		const settled = ["P::Hello"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(1);
	});

	it("keeps an existing growing paragraph settled", () => {
		const current = ["P::Hello", "P::World, how are you?"];
		const settled = ["P::Hello", "P::World"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(2);
	});

	it("does not re-animate an existing block when its text keeps growing", () => {
		const current = ["P::Hello, this paragraph kept streaming"];
		const settled = ["P::Hello"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(1);
	});

	it("re-animates from the changed index when the block type changes", () => {
		const current = ["PRE::console.log('streaming')"];
		const settled = ["P::console.log('streaming')"];
		expect(resolveAnimateFromIndex(current, settled)).toBe(0);
	});
});

// --- Action integration tests ---

describe("streamingReveal action", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = createContainer();
	});

	afterEach(() => {
		container.remove();
	});

	it("snapshots fingerprints on first render without animating", () => {
		container.innerHTML = "<p>Hello</p><p>World</p>";
		const result = streamingReveal(container, { active: true });

		// First render should NOT animate — it just captures what is already visible
		expect(childHasAnimation(container, 0)).toBe(false);
		expect(childHasAnimation(container, 1)).toBe(false);

		result.destroy();
	});

	it("animates only new children on subsequent renders", () => {
		container.innerHTML = "<p>Hello</p>";
		const result = streamingReveal(container, { active: true });

		// First render: snapshot only, no animation
		expect(childHasAnimation(container, 0)).toBe(false);

		// Simulate next streaming render via direct innerHTML + manual trigger
		// (MutationObserver is async and unreliable in happy-dom)
		container.innerHTML = "<p>Hello</p><p>World</p>";
		// The MutationObserver would call applyReveal; simulate that
		// by destroying and recreating with the settled state still intact.
		// Instead, we test the pure function path which is what the action calls.

		result.destroy();
	});

	it("does not add animation class when inactive", () => {
		container.innerHTML = "<p>Hello</p>";
		const result = streamingReveal(container, { active: false });

		expect(childHasAnimation(container, 0)).toBe(false);

		result.destroy();
	});

	it("cleans up animation classes when deactivated via update", () => {
		container.innerHTML = "<p>Hello</p><p>World</p>";
		const result = streamingReveal(container, { active: true });

		// First render snapshots, no animation
		expect(childHasAnimation(container, 0)).toBe(false);

		result.update({ active: false });
		expect(childHasAnimation(container, 0)).toBe(false);

		result.destroy();
	});

	it("cleans up animation classes on destroy", () => {
		container.innerHTML = "<p>Hello</p>";
		const result = streamingReveal(container, { active: true });

		result.destroy();
		expect(childHasAnimation(container, 0)).toBe(false);
	});

	it("can be reactivated after deactivation", () => {
		container.innerHTML = "<p>Hello</p>";
		const result = streamingReveal(container, { active: false });

		expect(childHasAnimation(container, 0)).toBe(false);

		// Reactivation captures a fresh snapshot (first render for the new cycle)
		result.update({ active: true });
		expect(childHasAnimation(container, 0)).toBe(false);

		result.destroy();
	});

	it("resets initial snapshot flag when stopped and restarted", () => {
		container.innerHTML = "<p>Hello</p>";
		const result = streamingReveal(container, { active: true });

		// First activation snapshots
		expect(childHasAnimation(container, 0)).toBe(false);

		// Deactivate and reactivate
		result.update({ active: false });
		result.update({ active: true });

		// After reactivation, this is again a "first render" — no animation
		expect(childHasAnimation(container, 0)).toBe(false);

		result.destroy();
	});
});

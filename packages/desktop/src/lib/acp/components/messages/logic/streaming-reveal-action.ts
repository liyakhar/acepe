/**
 * Svelte action that animates newly-appearing top-level child elements
 * inside a streaming markdown container.
 *
 * Cursor uses `.chat-fade-in * { animation: fade-in .25s ease }` on an
 * incremental DOM renderer where new elements are appended. Acepe re-renders
 * the entire markdown via `{@html}` every ~150 ms, so we cannot rely on CSS
 * animations alone — every element would re-animate on each render cycle.
 *
 * Instead we fingerprint each top-level child (tag + first 80 chars of text)
 * and only apply the fade-in animation class to children whose top-level block
 * identity was not present in the previous settled snapshot. A paragraph or
 * code block that is still growing keeps the same top-level identity, so it
 * continues streaming in place instead of restarting its fade every cycle.
 */

export const ANIMATION_CLASS = "streaming-fade-in";

/**
 * Fingerprint a DOM element by its tag + a prefix of its text content.
 * Two elements "match" when they represent the same markdown block
 * (paragraph, heading, list, code-block …). The text prefix is short enough
 * that a paragraph whose tokens keep arriving will change its fingerprint
 * and get re-animated until it stabilises.
 */
export function fingerprint(el: Element): string {
	const stableSectionKey = el.getAttribute("data-streaming-section-key");
	if (stableSectionKey) {
		return stableSectionKey;
	}

	const tag = el.tagName;
	const text = (el.textContent ?? "").slice(0, 80);
	return `${tag}::${text}`;
}

function getBlockIdentity(fingerprintValue: string): string {
	const separatorIndex = fingerprintValue.indexOf("::");
	if (separatorIndex === -1) {
		return fingerprintValue;
	}

	return fingerprintValue.slice(0, separatorIndex);
}

/**
 * Core logic for deciding which children to animate.
 *
 * Given the current fingerprints and the previously settled ones,
 * returns the index from which to start animating (everything before
 * that index is settled and should not animate).
 *
 * Accepts pre-computed fingerprints so callers can reuse them for the
 * settle snapshot without re-reading `el.textContent`.
 */
export function resolveAnimateFromIndex(
	currentFingerprints: readonly string[],
	settledFingerprints: readonly string[]
): number {
	const limit = Math.min(currentFingerprints.length, settledFingerprints.length);
	for (let i = 0; i < limit; i++) {
		if (getBlockIdentity(currentFingerprints[i]) !== getBlockIdentity(settledFingerprints[i])) {
			return i;
		}
	}

	return limit;
}

export interface StreamingRevealParams {
	/** When false the action becomes inert and resets internal state. */
	active: boolean;
}

export function streamingReveal(node: HTMLElement, params: StreamingRevealParams) {
	let settledFingerprints: string[] = [];
	let observer: MutationObserver | null = null;
	/** Whether we have seen at least one render. The very first render
	 *  just snapshots fingerprints without animating — the content that
	 *  was already visible should not flash. */
	let hasInitialSnapshot = false;

	function applyReveal() {
		const children = Array.from(node.children);
		if (children.length === 0) {
			return;
		}

		// Compute fingerprints once so we never read el.textContent twice
		// per child per cycle.
		const currentFingerprints = children.map(fingerprint);

		if (!hasInitialSnapshot) {
			// First render: snapshot fingerprints, don't animate anything.
			settledFingerprints = currentFingerprints;
			hasInitialSnapshot = true;
			return;
		}

		const animateFrom = resolveAnimateFromIndex(currentFingerprints, settledFingerprints);

		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (i < animateFrom) {
				child.classList.remove(ANIMATION_CLASS);
			} else {
				child.classList.add(ANIMATION_CLASS);
			}
		}

		// Settle immediately so the next render cycle (150 ms later) can
		// compare against the current state.  The previous approach used
		// setTimeout(…, 250) which was longer than the render interval,
		// causing every cycle to re-animate all children (flicker).
		settledFingerprints = currentFingerprints;
	}

	function start() {
		applyReveal();

		observer = new MutationObserver(() => {
			applyReveal();
		});
		observer.observe(node, { childList: true });
	}

	function stop() {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		settledFingerprints = [];
		hasInitialSnapshot = false;

		for (const child of Array.from(node.children)) {
			child.classList.remove(ANIMATION_CLASS);
		}
	}

	if (params.active) {
		start();
	}

	return {
		update(next: StreamingRevealParams) {
			if (next.active && !observer) {
				start();
			} else if (!next.active && observer) {
				stop();
			}
		},
		destroy() {
			stop();
		},
	};
}

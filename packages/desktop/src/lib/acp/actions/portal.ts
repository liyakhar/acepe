/**
 * Svelte action that teleports an element to document.body.
 * This escapes any parent transforms that would affect position: fixed.
 *
 * Usage:
 * ```svelte
 * <div use:portal class="fixed ...">
 *   Content that needs to escape parent transforms
 * </div>
 * ```
 */
export function portal(node: HTMLElement): { destroy: () => void } {
	// Store original parent and next sibling for potential restoration
	const originalParent = node.parentElement;
	const placeholder = document.createComment("portal");
	const originalPointerEvents = node.style.pointerEvents;
	const needsPointerEventsOverride = originalPointerEvents.length === 0;

	// Insert placeholder where the node was
	originalParent?.insertBefore(placeholder, node);

	// Bits UI modal dialogs disable pointer events on body. Custom portaled surfaces
	// need an explicit override so they remain interactive when appended there.
	if (needsPointerEventsOverride) {
		node.style.pointerEvents = "auto";
	}

	// Move node to body
	document.body.appendChild(node);

	return {
		destroy() {
			if (needsPointerEventsOverride) {
				node.style.pointerEvents = originalPointerEvents;
			}
			// Remove from body
			if (node.parentElement === document.body) {
				document.body.removeChild(node);
			}
			// Remove placeholder
			placeholder.remove();
		},
	};
}

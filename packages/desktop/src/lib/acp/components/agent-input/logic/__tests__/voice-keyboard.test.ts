import { describe, expect, it } from "vitest";

import { shouldStartVoiceHold, shouldStopVoiceHold } from "../voice-keyboard.js";

function createKeyboardEventLike(
	overrides: Partial<{
		altKey: boolean;
		code: string;
		ctrlKey: boolean;
		key: string;
		metaKey: boolean;
		repeat: boolean;
		shiftKey: boolean;
	}> = {},
) {
	return {
		altKey: false,
		code: "Space",
		ctrlKey: false,
		key: " ",
		metaKey: false,
		repeat: false,
		shiftKey: false,
		...overrides,
	};
}

describe("voice-keyboard", () => {
	it("starts hold only for a fresh bare space press", () => {
		expect(shouldStartVoiceHold(createKeyboardEventLike())).toBe(true);
		expect(shouldStartVoiceHold(createKeyboardEventLike({ repeat: true }))).toBe(false);
		expect(shouldStartVoiceHold(createKeyboardEventLike({ shiftKey: true }))).toBe(false);
	});

	it("stops hold on bare space release when active", () => {
		expect(shouldStopVoiceHold(createKeyboardEventLike(), true)).toBe(true);
		expect(shouldStopVoiceHold(createKeyboardEventLike({ ctrlKey: true }), true)).toBe(false);
		expect(shouldStopVoiceHold(createKeyboardEventLike(), false)).toBe(false);
	});
});

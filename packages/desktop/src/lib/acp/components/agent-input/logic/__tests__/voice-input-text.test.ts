import { describe, expect, it } from "vitest";

import { normalizeVoiceInputText } from "../voice-input-text.js";

describe("normalizeVoiceInputText", () => {
	it("collapses escaped and real newlines into inline spaces", () => {
		expect(normalizeVoiceInputText("hello\\nworld\nagain")).toBe("hello world again");
	});
});

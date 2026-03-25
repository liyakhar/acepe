import { describe, expect, it } from "vitest";
import type { VoiceInputPhase } from "$lib/acp/types/voice-input.js";
import { getMicButtonVisualState } from "../mic-button-state.js";

describe("getMicButtonVisualState", () => {
	it.each([
		"loading_model",
		"checking_permission",
		"transcribing",
	] satisfies VoiceInputPhase[])("returns spinner for %s", (phase) => {
		expect(getMicButtonVisualState(phase)).toBe("spinner");
	});

	it("returns download progress while downloading", () => {
		expect(getMicButtonVisualState("downloading_model")).toBe("download_progress");
	});

	it("returns stop while recording", () => {
		expect(getMicButtonVisualState("recording")).toBe("stop");
	});

	it.each(["idle", "complete", "cancelled", "error"] satisfies VoiceInputPhase[])(
		"returns mic for %s",
		(phase) => {
			expect(getMicButtonVisualState(phase)).toBe("mic");
		},
	);
});

import { describe, expect, it } from "vitest";

import { resolveConfigOptionIconState } from "./config-option-selector-icon-state.js";

describe("resolveConfigOptionIconState", () => {
	it("uses regular muted icon when fast mode is disabled in a select option", () => {
		expect(
			resolveConfigOptionIconState({
				isFastOption: true,
				isBooleanOption: false,
				isBooleanEnabled: false,
				currentValue: "standard",
			})
		).toEqual({
			weight: "regular",
			useMutedForeground: true,
		});
	});

	it("uses filled icon when fast mode is enabled in a select option", () => {
		expect(
			resolveConfigOptionIconState({
				isFastOption: true,
				isBooleanOption: false,
				isBooleanEnabled: false,
				currentValue: "fast",
			})
		).toEqual({
			weight: "fill",
			useMutedForeground: false,
		});
	});

	it("uses regular muted icon when fast mode boolean is off", () => {
		expect(
			resolveConfigOptionIconState({
				isFastOption: true,
				isBooleanOption: true,
				isBooleanEnabled: false,
				currentValue: "false",
			})
		).toEqual({
			weight: "regular",
			useMutedForeground: true,
		});
	});

	it("keeps non-fast icons filled", () => {
		expect(
			resolveConfigOptionIconState({
				isFastOption: false,
				isBooleanOption: false,
				isBooleanEnabled: false,
				currentValue: "medium",
			})
		).toEqual({
			weight: "fill",
			useMutedForeground: false,
		});
	});
});

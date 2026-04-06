type IconWeight = "fill" | "regular";

export interface ConfigOptionIconStateInput {
	readonly isFastOption: boolean;
	readonly isBooleanOption: boolean;
	readonly isBooleanEnabled: boolean;
	readonly currentValue: string | null;
}

export interface ConfigOptionIconState {
	readonly weight: IconWeight;
	readonly useMutedForeground: boolean;
}

function isFastValueEnabled(value: string | null): boolean {
	if (value === null) {
		return false;
	}

	const normalizedValue = value.toLowerCase();
	return (
		normalizedValue === "fast" ||
		normalizedValue === "true" ||
		normalizedValue === "on" ||
		normalizedValue === "enabled"
	);
}

function isFastModeEnabled(input: ConfigOptionIconStateInput): boolean {
	if (!input.isFastOption) {
		return false;
	}

	if (input.isBooleanOption) {
		return input.isBooleanEnabled;
	}

	return isFastValueEnabled(input.currentValue);
}

export function resolveConfigOptionIconState(
	input: ConfigOptionIconStateInput
): ConfigOptionIconState {
	if (!input.isFastOption) {
		return {
			weight: "fill",
			useMutedForeground: false,
		};
	}

	if (!isFastModeEnabled(input)) {
		return {
			weight: "regular",
			useMutedForeground: true,
		};
	}

	return {
		weight: "fill",
		useMutedForeground: false,
	};
}

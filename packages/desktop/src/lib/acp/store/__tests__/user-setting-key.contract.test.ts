import { describe, expect, it } from "bun:test";

import type { UserSettingKey } from "$lib/services/converted-session-types.js";

const PR_GENERATION_PREFERENCES_KEY = "pr_generation_preferences" satisfies UserSettingKey;

describe("user setting key contract", () => {
	it("includes the PR generation preferences key in the shared settings contract", () => {
		expect(PR_GENERATION_PREFERENCES_KEY).toBe("pr_generation_preferences");
	});
});
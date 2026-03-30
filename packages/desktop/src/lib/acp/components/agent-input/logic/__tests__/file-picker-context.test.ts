import { describe, expect, it } from "vitest";

import { getEffectiveFilePickerProjectPath } from "../file-picker-context.js";

describe("getEffectiveFilePickerProjectPath", () => {
	it("prefers the active worktree path", () => {
		expect(
			getEffectiveFilePickerProjectPath("/tmp/project", "/tmp/project/.worktrees/feature")
		).toBe("/tmp/project/.worktrees/feature");
	});

	it("falls back to the project path when no worktree is active", () => {
		expect(getEffectiveFilePickerProjectPath("/tmp/project", null)).toBe("/tmp/project");
		expect(getEffectiveFilePickerProjectPath(null, null)).toBeNull();
	});
});

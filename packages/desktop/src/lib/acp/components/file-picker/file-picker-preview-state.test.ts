import { describe, expect, it } from "vitest";

import type { FilePickerEntry } from "../../types/file-picker-entry.js";

import { getPreviewFile, shouldDeferFilePreview } from "./file-picker-preview-state.js";

function createFile(path: string): FilePickerEntry {
	const extension = path.split(".").pop();
	return {
		path,
		extension: extension ? extension : "",
		lineCount: 1,
		gitStatus: null,
	};
}

describe("file picker preview state", () => {
	it("defers preview while a non-empty query is actively changing", () => {
		expect(shouldDeferFilePreview("")).toBe(false);
		expect(shouldDeferFilePreview("abc")).toBe(true);
	});

	it("hides preview while filtering with a query", () => {
		const files = [createFile("src/app.ts")];

		expect(getPreviewFile(files, 0, true)).toBeNull();
	});

	it("shows preview when there is no active query", () => {
		const files = [createFile("src/app.ts"), createFile("src/lib.ts")];

		expect(getPreviewFile(files, 1, false)).toEqual(files[1]);
	});
});

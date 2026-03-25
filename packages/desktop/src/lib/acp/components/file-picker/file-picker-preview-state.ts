import type { FilePickerEntry } from "../../types/file-picker-entry.js";

export function shouldDeferFilePreview(query: string): boolean {
	return query.trim().length > 0;
}

export function getPreviewFile(
	filteredFiles: FilePickerEntry[],
	selectedIndex: number,
	deferPreview: boolean
): FilePickerEntry | null {
	if (filteredFiles.length === 0) {
		return null;
	}

	if (deferPreview) {
		return null;
	}

	const clampedIndex = Math.max(0, Math.min(selectedIndex, filteredFiles.length - 1));
	const file = filteredFiles[clampedIndex];
	return file ? file : null;
}

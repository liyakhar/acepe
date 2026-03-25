import { diffAcceptRejectHunk, type FileDiffMetadata } from "@pierre/diffs";

/**
 * Computes the full file content with a specific hunk reverted.
 *
 * When a hunk is rejected, we need to:
 * 1. Take the new file content (current state)
 * 2. Find each change block in the hunk
 * 3. Replace additions with deletions while preserving context
 * 4. Return the resulting content
 *
 * @param newFileContent - The current content of the file (with all changes applied)
 * @param fileDiffMetadata - The diff metadata containing hunk information
 * @param hunkIndex - The index of the hunk to revert
 * @returns The file content with the specified hunk reverted
 */
export function computeRevertedFileContent(
	newFileContent: string,
	fileDiffMetadata: FileDiffMetadata,
	hunkIndex: number
): string {
	// Get the hunk to revert
	const hunk = fileDiffMetadata.hunks[hunkIndex];
	if (!hunk) {
		// Hunk index out of bounds, return original content
		return newFileContent;
	}

	const revertedMetadata = diffAcceptRejectHunk(fileDiffMetadata, hunkIndex, "reject");
	return revertedMetadata.additionLines.join("");
}

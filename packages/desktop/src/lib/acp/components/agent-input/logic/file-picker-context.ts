export function getEffectiveFilePickerProjectPath(
	projectPath: string | null | undefined,
	worktreePath: string | null | undefined
): string | null {
	if (worktreePath) {
		return worktreePath;
	}

	return projectPath ? projectPath : null;
}

/**
 * Session identity - immutable lookup keys.
 *
 * The local Acepe session ID is the canonical reconnect key. The remaining
 * fields are persisted descriptor facts used for display and history loading,
 * but existing-session resume resolution stays backend-owned.
 */
export interface SessionIdentity {
	readonly id: string;
	readonly projectPath: string;
	readonly agentId: string;
	/**
	 * Optional worktree path when session operates in a git worktree.
	 * Used for path conversion when creating checkpoints.
	 */
	readonly worktreePath?: string;
}

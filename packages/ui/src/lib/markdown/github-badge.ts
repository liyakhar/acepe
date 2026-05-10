/**
 * Shared constants and utilities for GitHub reference badges.
 * Used by the shared githubBadgePlugin and MarkdownDisplay.
 */

/** Discriminated union for parsed GitHub references */
export type GitHubReference =
	| { type: "pr"; owner: string; repo: string; number: number }
	| { type: "commit"; sha: string; owner?: string; repo?: string }
	| { type: "issue"; owner: string; repo: string; number: number };

/** Matches PR/Issue shorthand: owner/repo#123 */
export const GITHUB_PR_SHORTHAND_PATTERN = /\b([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)#(\d+)\b/g;

/** Matches bare commit SHAs: 7-40 lowercase hex characters with at least one a-f letter */
export const GITHUB_COMMIT_SHA_PATTERN =
	/(?<!@)\b(?=[a-f0-9]{7,40}\b)(?=[a-f0-9]*[a-f][a-f0-9]*\b)([a-f0-9]{7,40})\b/g;

/** Matches git references: @abc1234 */
export const GITHUB_GIT_REF_PATTERN = /@([a-f0-9]{7,40})\b/g;

/** Matches full GitHub URLs for commits and PRs */
export const GITHUB_URL_PATTERN =
	/https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/(pull|commit|issues?)\/([a-zA-Z0-9]+)/gi;

export function isBareCommitSHA(value: string): boolean {
	GITHUB_COMMIT_SHA_PATTERN.lastIndex = 0;
	const match = GITHUB_COMMIT_SHA_PATTERN.exec(value);
	GITHUB_COMMIT_SHA_PATTERN.lastIndex = 0;
	return match !== null && match[0] === value;
}

export function parsePRShorthand(owner: string, repo: string, number: string): GitHubReference {
	return { type: "pr", owner, repo, number: parseInt(number, 10) };
}

export function parseCommitSHA(sha: string): GitHubReference {
	return { type: "commit", sha };
}

export function parseGitHubURL(
	owner: string,
	repo: string,
	refType: string,
	ref: string
): GitHubReference {
	if (refType === "pull") return { type: "pr", owner, repo, number: parseInt(ref, 10) };
	if (refType === "commit") return { type: "commit", sha: ref, owner, repo };
	return { type: "issue", owner, repo, number: parseInt(ref, 10) };
}

export function getGitHubURL(ref: GitHubReference): string {
	if (ref.type === "pr") return `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
	if (ref.type === "commit" && ref.owner && ref.repo)
		return `https://github.com/${ref.owner}/${ref.repo}/commit/${ref.sha}`;
	if (ref.type === "issue") return `https://github.com/${ref.owner}/${ref.repo}/issues/${ref.number}`;
	return "";
}

export function getGitHubLabel(ref: GitHubReference): string {
	if (ref.type === "commit") return ref.sha.slice(0, 7);
	return `${ref.owner}/${ref.repo}#${ref.number}`;
}

/**
 * Creates a placeholder span for a GitHub badge.
 * Mounted by MarkdownDisplay (static HTML) or markdown-text.svelte (GitHubBadge component).
 */
export function createGitHubBadgePlaceholder(ref: GitHubReference): string {
	const refJson = encodeURIComponent(JSON.stringify(ref));
	return `<span class="github-badge-placeholder" data-reveal-skip data-github-ref="${refJson}"></span>`;
}

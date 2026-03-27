import type { Component } from 'svelte';
import type { ResultAsync } from 'neverthrow';
import { Bug, ChatCircle, Circle, Eye, Heart, Lightbulb, Question, Rocket, Tag, ThumbsUp, XCircle } from 'phosphor-svelte';

// ─── GitHub data types (from Tauri invoke) ─────────────────────────

export interface GitHubUser {
	login: string;
	avatarUrl: string;
	htmlUrl: string;
}

export interface GitHubLabel {
	name: string;
	color: string;
	description?: string;
}

export interface GitHubReactions {
	plus1: number;
	minus1: number;
	heart: number;
	rocket: number;
	eyes: number;
	totalCount: number;
}

export interface GitHubIssue {
	number: number;
	title: string;
	body: string;
	state: 'open' | 'closed';
	labels: GitHubLabel[];
	author: GitHubUser;
	commentsCount: number;
	reactions: GitHubReactions;
	createdAt: string;
	updatedAt: string;
	htmlUrl: string;
}

export interface GitHubComment {
	id: number;
	body: string;
	author: GitHubUser;
	reactions: GitHubReactions;
	createdAt: string;
	updatedAt: string;
	htmlUrl: string;
}

export interface IssueListResult {
	items: GitHubIssue[];
	totalCount?: number;
	hasNextPage: boolean;
}

export interface AuthStatus {
	authenticated: boolean;
	username?: string;
	ghInstalled: boolean;
}

// ─── View state ────────────────────────────────────────────────────

export type View =
	| { kind: 'list' }
	| { kind: 'detail'; issueNumber: number }
	| { kind: 'create' };

// ─── Category config (maps GitHub labels → display) ────────────────

export type IssueCategory = 'bug' | 'enhancement' | 'question' | 'discussion';

export const CATEGORY_LABEL_MAP: Record<string, IssueCategory> = {
	bug: 'bug',
	enhancement: 'enhancement',
	question: 'question',
	discussion: 'discussion'
};

export const CATEGORY_CONFIG: Record<
	IssueCategory,
	{ label: string; icon: Component; classes: string; githubLabel: string }
> = {
	bug: {
		label: 'Bug',
		icon: Bug,
		classes: 'bg-[#FF5D5A]/10 text-[#FF5D5A] border-[#FF5D5A]/25',
		githubLabel: 'bug'
	},
	enhancement: {
		label: 'Feature',
		icon: Lightbulb,
		classes: 'bg-[#9858FF]/10 text-[#9858FF] border-[#9858FF]/25',
		githubLabel: 'enhancement'
	},
	question: {
		label: 'Question',
		icon: Question,
		classes: 'bg-[#4AD0FF]/10 text-[#4AD0FF] border-[#4AD0FF]/25',
		githubLabel: 'question'
	},
	discussion: {
		label: 'Discussion',
		icon: ChatCircle,
		classes: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/25',
		githubLabel: 'discussion'
	}
};

export const UNKNOWN_LABEL_CONFIG = {
	icon: Tag,
	classes: 'bg-accent/20 text-muted-foreground border-border/30'
};

// ─── Status config (GitHub issue state) ────────────────────────────

export type IssueState = 'open' | 'closed';

export const STATUS_CONFIG: Record<IssueState, { label: string; icon: Component; color: string }> =
	{
		open: { label: 'Open', icon: Circle, color: 'text-[var(--success)]' },
		closed: { label: 'Closed', icon: XCircle, color: 'text-[#FF5D5A]' }
	};

// ─── Error types ───────────────────────────────────────────────────

export type GitHubErrorKind = 'auth_required' | 'rate_limited' | 'not_found' | 'gh_not_installed' | 'network' | 'unknown';

export interface GitHubError {
	kind: GitHubErrorKind;
	message: string;
}

// ─── Service interface (implemented by desktop layer via Tauri invoke) ──

export interface GitHubService {
	checkAuth(): ResultAsync<AuthStatus, GitHubError>;
	listIssues(params: {
		state?: string;
		labels?: string;
		sort?: string;
		direction?: string;
		page?: number;
		perPage?: number;
	}): ResultAsync<IssueListResult, GitHubError>;
	searchIssues(params: {
		query: string;
		state?: string;
		labels?: string;
		sort?: string;
		page?: number;
		perPage?: number;
	}): ResultAsync<IssueListResult, GitHubError>;
	getIssue(number: number): ResultAsync<GitHubIssue, GitHubError>;
	createIssue(params: {
		title: string;
		body: string;
		labels?: string[];
	}): ResultAsync<GitHubIssue, GitHubError>;
	listComments(issueNumber: number, page?: number): ResultAsync<GitHubComment[], GitHubError>;
	createComment(issueNumber: number, body: string): ResultAsync<GitHubComment, GitHubError>;
	toggleIssueReaction(issueNumber: number, content: string): ResultAsync<boolean, GitHubError>;
	toggleCommentReaction(commentId: number, content: string): ResultAsync<boolean, GitHubError>;
}

/** Unwrap a ResultAsync for use in TanStack Query queryFn (throws on Err) */
export async function unwrapResult<T>(result: ResultAsync<T, GitHubError>): Promise<T> {
	const r = await result;
	if (r.isErr()) throw r.error;
	return r.value;
}

// ─── Helpers ───────────────────────────────────────────────────────

export function formatTimeAgo(iso: string): string {
	const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return 'now';
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
	if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
	return `${Math.floor(seconds / 2592000)}mo`;
}

/** Get the primary category from an issue's labels, if any */
export function getIssueCategory(labels: GitHubLabel[]): IssueCategory | null {
	for (const label of labels) {
		const cat = CATEGORY_LABEL_MAP[label.name];
		if (cat) return cat;
	}
	return null;
}

// ─── Reaction config ───────────────────────────────────────────────

export type ReactionKey = 'plus1' | 'heart' | 'rocket' | 'eyes';

export interface ReactionConfig {
	content: string;
	key: ReactionKey;
	icon: Component;
}

export const REACTION_CONFIG: ReactionConfig[] = [
	{ content: '+1', key: 'plus1', icon: ThumbsUp },
	{ content: 'heart', key: 'heart', icon: Heart },
	{ content: 'rocket', key: 'rocket', icon: Rocket },
	{ content: 'eyes', key: 'eyes', icon: Eye }
];

// ─── Optimistic comment ────────────────────────────────────────────

/** A comment that has been submitted but not yet confirmed by the server */
export interface OptimisticComment {
	_optimistic: true;
	/** Unique ID for keying — negative to avoid collisions with real IDs */
	id: number;
	body: string;
	authorLogin: string;
	createdAt: string;
}

/** Union of server comment and optimistic comment for rendering */
export type CommentRow = GitHubComment | OptimisticComment;

export function isOptimisticComment(row: CommentRow): row is OptimisticComment {
	return '_optimistic' in row && row._optimistic === true;
}

/**
 * Build an optimistic comment to prepend to the cache while awaiting the server.
 * Uses a negative timestamp-based ID to avoid collisions with real GitHub IDs.
 */
export function buildOptimisticComment(body: string, authorLogin: string): OptimisticComment {
	return {
		_optimistic: true,
		id: -Date.now(),
		body,
		authorLogin,
		createdAt: new Date().toISOString()
	};
}

/**
 * Apply a reaction toggle to a `GitHubReactions` object, returning a new object.
 * `added` = true means the reaction was added, false means removed.
 */
export function applyReactionToggle(
	reactions: GitHubReactions,
	key: ReactionKey,
	added: boolean
): GitHubReactions {
	const delta = added ? 1 : -1;
	const newCount = Math.max(0, reactions[key] + delta);
	const newTotal = Math.max(0, reactions.totalCount + delta);
	return {
		plus1: key === 'plus1' ? newCount : reactions.plus1,
		minus1: reactions.minus1,
		heart: key === 'heart' ? newCount : reactions.heart,
		rocket: key === 'rocket' ? newCount : reactions.rocket,
		eyes: key === 'eyes' ? newCount : reactions.eyes,
		totalCount: newTotal
	};
}

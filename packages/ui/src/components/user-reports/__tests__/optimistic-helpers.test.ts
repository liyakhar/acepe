import { describe, expect, it } from 'bun:test';
import {
	applyReactionToggle,
	buildOptimisticComment,
	isOptimisticComment
} from '../types.js';
import type { GitHubComment, GitHubReactions, OptimisticComment } from '../types.js';

// ─── applyReactionToggle ──────────────────────────────────────────

const baseReactions: GitHubReactions = {
	plus1: 2,
	minus1: 0,
	heart: 1,
	rocket: 0,
	eyes: 3,
	totalCount: 6
};

describe('applyReactionToggle', () => {
	it('increments the correct key and totalCount when added=true', () => {
		const result = applyReactionToggle(baseReactions, 'plus1', true);
		expect(result.plus1).toBe(3);
		expect(result.totalCount).toBe(7);
		// other keys untouched
		expect(result.heart).toBe(1);
		expect(result.rocket).toBe(0);
		expect(result.eyes).toBe(3);
	});

	it('decrements the correct key and totalCount when added=false', () => {
		const result = applyReactionToggle(baseReactions, 'heart', false);
		expect(result.heart).toBe(0);
		expect(result.totalCount).toBe(5);
	});

	it('does not go below 0 for the key', () => {
		const result = applyReactionToggle(baseReactions, 'rocket', false);
		expect(result.rocket).toBe(0);
	});

	it('does not go below 0 for totalCount', () => {
		const zeroed: GitHubReactions = { plus1: 0, minus1: 0, heart: 0, rocket: 0, eyes: 0, totalCount: 0 };
		const result = applyReactionToggle(zeroed, 'eyes', false);
		expect(result.totalCount).toBe(0);
		expect(result.eyes).toBe(0);
	});

	it('does not mutate the original object', () => {
		applyReactionToggle(baseReactions, 'plus1', true);
		expect(baseReactions.plus1).toBe(2);
	});
});

// ─── buildOptimisticComment ───────────────────────────────────────

describe('buildOptimisticComment', () => {
	it('sets _optimistic flag to true', () => {
		const c = buildOptimisticComment('hello', 'alice');
		expect(c._optimistic).toBe(true);
	});

	it('stores body and authorLogin', () => {
		const c = buildOptimisticComment('hello world', 'alice');
		expect(c.body).toBe('hello world');
		expect(c.authorLogin).toBe('alice');
	});

	it('assigns a negative ID', () => {
		const c = buildOptimisticComment('hi', 'bob');
		expect(c.id).toBeLessThan(0);
	});

	it('assigns a valid ISO createdAt', () => {
		const before = Date.now();
		const c = buildOptimisticComment('hi', 'bob');
		const after = Date.now();
		const ts = new Date(c.createdAt).getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});

// ─── isOptimisticComment ──────────────────────────────────────────

describe('isOptimisticComment', () => {
	it('returns true for an OptimisticComment', () => {
		const c: OptimisticComment = {
			_optimistic: true,
			id: -1,
			body: 'test',
			authorLogin: 'alice',
			createdAt: new Date().toISOString()
		};
		expect(isOptimisticComment(c)).toBe(true);
	});

	it('returns false for a GitHubComment', () => {
		const c: GitHubComment = {
			id: 42,
			body: 'real comment',
			author: { login: 'alice', avatarUrl: '', htmlUrl: '' },
			reactions: { plus1: 0, minus1: 0, heart: 0, rocket: 0, eyes: 0, totalCount: 0 },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			htmlUrl: ''
		};
		expect(isOptimisticComment(c)).toBe(false);
	});
});

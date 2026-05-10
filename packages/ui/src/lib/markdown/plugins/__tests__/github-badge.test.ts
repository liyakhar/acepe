import { describe, expect, it } from "bun:test";
import MarkdownIt from "markdown-it";

import { GITHUB_COMMIT_SHA_PATTERN } from "../../github-badge.js";
import { githubBadgePlugin } from "../github-badge.js";

function renderWithGitHubBadges(markdown: string): string {
	const md = new MarkdownIt();
	md.use(githubBadgePlugin);
	return md.render(markdown);
}

describe("shared githubBadgePlugin", () => {
	it("does not match all-digit timestamps as bare commit SHAs", () => {
		const text =
			"FIXQA-BADGE-1777753105123 Smooth runtime badge QA 1777753105123";
		const matches = [...text.matchAll(GITHUB_COMMIT_SHA_PATTERN)];

		expect(matches).toHaveLength(0);
	});

	it("does not render all-digit timestamps as bare commit badges", () => {
		const html = renderWithGitHubBadges(
			"FIXQA-BADGE-1777753105123 Smooth runtime badge QA 1777753105123"
		);

		expect(html).not.toContain("github-badge-placeholder");
		expect(html).toContain("1777753105123");
	});

	it("does not render all-digit inline code as a commit badge", () => {
		const html = renderWithGitHubBadges("Timestamp `1777753105123` should stay code.");

		expect(html).not.toContain("github-badge-placeholder");
		expect(html).toContain("<code>1777753105123</code>");
	});

	it("still renders mixed hex bare commit SHAs as badges", () => {
		const html = renderWithGitHubBadges("Fixed by abc1234.");

		expect(html).toContain("github-badge-placeholder");
	});
});

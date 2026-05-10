import { describe, expect, it } from "bun:test";
import MarkdownIt from "markdown-it";

import { githubBadgePlugin } from "../github-badge.js";

function renderWithGitHubBadges(markdown: string): string {
	const md = new MarkdownIt();
	md.use(githubBadgePlugin);
	return md.render(markdown);
}

describe("githubBadgePlugin", () => {
	it("does not render all-digit timestamps as bare commit badges", () => {
		const html = renderWithGitHubBadges(
			"FIXQA4-1777748119374 Smooth streaming keeps token cadence. 1777748119374"
		);

		expect(html).not.toContain("github-badge-placeholder");
		expect(html).toContain("1777748119374");
	});

	it("does not render all-digit inline code as a commit badge", () => {
		const html = renderWithGitHubBadges("Timestamp `1777748119374` should stay code.");

		expect(html).not.toContain("github-badge-placeholder");
		expect(html).toContain("<code>1777748119374</code>");
	});

	it("still renders mixed hex bare commit SHAs as badges", () => {
		const html = renderWithGitHubBadges("Fixed by abc1234.");

		expect(html).toContain("github-badge-placeholder");
	});
});

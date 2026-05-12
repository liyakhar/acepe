import { describe, expect, it } from "bun:test";
import MarkdownIt from "markdown-it";

import { countWordsInMarkdown } from "../../index.js";
import { fenceHandlerPlugin } from "../fence-handler.js";
import { tokenWordWrapPlugin } from "../token-word-wrap.js";

function renderWithPlugin(markdown: string): string {
	const md = MarkdownIt({ html: false, linkify: true, typographer: false });
	md.use(fenceHandlerPlugin);
	md.use(tokenWordWrapPlugin);
	return md.render(markdown);
}

function countWrappedTokens(html: string): number {
	return (html.match(/class="tok(?:\s|")/g) ?? []).length;
}

describe("tokenWordWrapPlugin", () => {
	it("wraps plain words into deterministic tok spans", () => {
		const html = renderWithPlugin("hello brave world");

		expect(countWrappedTokens(html)).toBe(3);
		expect(html).toContain('<span class="tok" style="--i:0">hello</span>');
		expect(html).toContain('<span class="tok" style="--i:1">brave</span>');
		expect(html).toContain('<span class="tok" style="--i:2">world</span>');
	});

	it("treats emphasis, links, and inline code as atomic reveal slots", () => {
		const html = renderWithPlugin("**hello world** [docs now](/docs) `pwd`");

		expect(countWrappedTokens(html)).toBe(3);
		expect(html).toContain(
			'<span class="tok" style="--i:0"><strong>hello world</strong></span>'
		);
		expect(html).toContain('<span class="tok" style="--i:1"><a href="/docs">docs now</a></span>');
		expect(html).toContain('<span class="tok" style="--i:2"><code>pwd</code></span>');
	});

	it("wraps a fenced code block as one reveal slot without wrapping its contents", () => {
		const html = renderWithPlugin("before\n\n```ts\nconst answer = 42;\n```\n\nafter");

		expect(countWrappedTokens(html)).toBe(3);
		expect(html).toContain('<div class="tok tok-block" style="--i:1">');
		expect(html).toContain("<pre><code");
		expect(html).toContain("const answer = 42;");
		expect(html).toContain('<span class="tok" style="--i:2">after</span>');
		expect(html).not.toContain('<span class="tok" style="--i:2">const</span>');
	});
});

describe("countWordsInMarkdown", () => {
	it("matches the renderer slot semantics", () => {
		expect(countWordsInMarkdown("**hello world** after `pwd`")).toBe(3);
		expect(countWordsInMarkdown("one\ntwo three")).toBe(3);
		expect(countWordsInMarkdown("before\n\n```ts\nconst answer = 42;\n```\n\nafter")).toBe(3);
	});
});

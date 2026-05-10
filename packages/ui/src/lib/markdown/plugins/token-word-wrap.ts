import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token.mjs";

import { checkboxBadgePlugin } from "./checkbox-badge.js";
import { colorBadgePlugin } from "./color-badge.js";
import { fenceHandlerPlugin } from "./fence-handler.js";
import { filePathBadgePlugin } from "./file-path-badge.js";
import { githubBadgePlugin } from "./github-badge.js";
import { sanitizeLanguagesPlugin } from "./sanitize-languages.js";
import { tableWrapperPlugin } from "./table-wrapper.js";

const WORD_SPLIT_PATTERN = /(\s+)/u;
const ATOMIC_INLINE_OPEN_TOKEN_TYPES = new Set(["em_open", "strong_open", "link_open", "s_open"]);
const COUNTING_MD = new MarkdownIt({ html: false, linkify: true, typographer: false });

sanitizeLanguagesPlugin(COUNTING_MD);
fenceHandlerPlugin(COUNTING_MD);
tableWrapperPlugin(COUNTING_MD);
checkboxBadgePlugin(COUNTING_MD);
colorBadgePlugin(COUNTING_MD);
filePathBadgePlugin(COUNTING_MD);
githubBadgePlugin(COUNTING_MD);

function createTextToken(content: string): Token {
	const token = new Token("text", "", 0);
	token.content = content;
	return token;
}

function createHtmlInlineToken(content: string): Token {
	const token = new Token("html_inline", "", 0);
	token.content = content;
	return token;
}

function buildWrappedSlot(content: string, wordIndex: number): string {
	return `<span class="tok" style="--i:${wordIndex}">${content}</span>`;
}

function countNonWhitespaceParts(text: string): number {
	return text
		.split(WORD_SPLIT_PATTERN)
		.filter((part) => part.trim().length > 0).length;
}

function findAtomicInlineGroupEnd(children: readonly Token[], startIndex: number): number | null {
	const startToken = children[startIndex];
	if (
		startToken === undefined ||
		startToken.nesting !== 1 ||
		!ATOMIC_INLINE_OPEN_TOKEN_TYPES.has(startToken.type)
	) {
		return null;
	}

	const closeTokenType = startToken.type.replace("_open", "_close");
	let depth = 0;
	for (let index = startIndex; index < children.length; index += 1) {
		const token = children[index];
		if (token === undefined) {
			continue;
		}
		if (token.type === startToken.type) {
			depth += 1;
			continue;
		}
		if (token.type !== closeTokenType) {
			continue;
		}
		depth -= 1;
		if (depth === 0) {
			return index;
		}
	}

	return null;
}

function countInlineWordSlots(children: readonly Token[]): number {
	let wordCount = 0;

	for (let index = 0; index < children.length; index += 1) {
		const token = children[index];
		if (token === undefined) {
			continue;
		}
		if (token.type === "text") {
			wordCount += countNonWhitespaceParts(token.content);
			continue;
		}
		if (token.type === "code_inline") {
			wordCount += 1;
			continue;
		}
		const atomicGroupEnd = findAtomicInlineGroupEnd(children, index);
		if (atomicGroupEnd !== null) {
			wordCount += 1;
			index = atomicGroupEnd;
		}
	}

	return wordCount;
}

function wrapInlineChildren(input: {
	readonly md: MarkdownIt;
	readonly env: object;
	readonly children: readonly Token[];
	readonly startWordIndex: number;
}): {
	readonly children: Token[];
	readonly nextWordIndex: number;
} {
	const nextChildren: Token[] = [];
	let wordIndex = input.startWordIndex;

	for (let index = 0; index < input.children.length; index += 1) {
		const token = input.children[index];
		if (token === undefined) {
			continue;
		}

		if (token.type === "text") {
			for (const part of token.content.split(WORD_SPLIT_PATTERN)) {
				if (part.length === 0) {
					continue;
				}
				if (part.trim().length === 0) {
					nextChildren.push(createTextToken(part));
					continue;
				}
				nextChildren.push(
					createHtmlInlineToken(
						buildWrappedSlot(input.md.utils.escapeHtml(part), wordIndex)
					)
				);
				wordIndex += 1;
			}
			continue;
		}

		if (token.type === "code_inline") {
			nextChildren.push(
				createHtmlInlineToken(
					buildWrappedSlot(
						input.md.renderer.renderInline([token], input.md.options, input.env),
						wordIndex
					)
				)
			);
			wordIndex += 1;
			continue;
		}

		const atomicGroupEnd = findAtomicInlineGroupEnd(input.children, index);
		if (atomicGroupEnd !== null) {
			nextChildren.push(
				createHtmlInlineToken(
					buildWrappedSlot(
						input.md.renderer.renderInline(
							input.children.slice(index, atomicGroupEnd + 1),
							input.md.options,
							input.env
						),
						wordIndex
					)
				)
			);
			wordIndex += 1;
			index = atomicGroupEnd;
			continue;
		}

		nextChildren.push(token);
	}

	return {
		children: nextChildren,
		nextWordIndex: wordIndex,
	};
}

export function countWordsInMarkdown(markdown: string): number {
	const tokens = COUNTING_MD.parse(markdown, {});
	let wordCount = 0;

	for (const token of tokens) {
		if (token.type === "inline" && token.children !== null) {
			wordCount += countInlineWordSlots(token.children);
			continue;
		}
		if (token.type === "fence") {
			wordCount += 1;
		}
	}

	return wordCount;
}

export function tokenWordWrapPlugin(md: MarkdownIt): void {
	md.core.ruler.push("token_word_wrap", (state) => {
		let wordIndex = 0;

		for (const token of state.tokens) {
			if (token.type === "fence") {
				token.attrSet("data-token-index", String(wordIndex));
				wordIndex += 1;
				continue;
			}

			if (token.type !== "inline" || token.children === null) {
				continue;
			}

			const wrapped = wrapInlineChildren({
				md,
				env: state.env,
				children: token.children,
				startWordIndex: wordIndex,
			});
			token.children = wrapped.children;
			wordIndex = wrapped.nextWordIndex;
		}
	});
}

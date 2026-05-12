import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const PIERRE_FILE_CHAR_THRESHOLD = 4000;
const PIERRE_FILE_LINE_THRESHOLD = 80;

function shouldUsePierreFileView(code: string): boolean {
	if (code.length >= PIERRE_FILE_CHAR_THRESHOLD) {
		return true;
	}
	return code.split("\n").length >= PIERRE_FILE_LINE_THRESHOLD;
}

function takeTokenRevealIndex(token: Token): string | null {
	const tokenIndex = token.attrGet("data-token-index");
	if (tokenIndex === null || !/^\d+$/u.test(tokenIndex)) {
		return null;
	}

	token.attrs = token.attrs?.filter(([name]) => name !== "data-token-index") ?? null;
	return tokenIndex;
}

function wrapTokenRevealBlock(tokenIndex: string | null, html: string): string {
	if (tokenIndex === null) {
		return html;
	}
	return `<div class="tok tok-block" style="--i:${tokenIndex}"><div class="tok-block-inner">${html}</div></div>`;
}

/**
 * Adds custom rendering for mermaid code blocks and large code fences.
 * - Mermaid: Converts to placeholder divs for MermaidDiagram component
 * - Large fences: Renders via @pierre/diffs FileView for better performance
 * - Other fences: Adds data-scrollable attribute for scroll detection
 */
export function fenceHandlerPlugin(md: MarkdownIt): void {
	const originalFence = md.renderer.rules.fence;

	md.renderer.rules.fence = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const lang = token.info.trim().split(/\s+/)[0];
		const tokenRevealIndex = takeTokenRevealIndex(token);

		if (lang === "mermaid") {
			const code = token.content.trim();
			const encodedCode = encodeURIComponent(code);
			return wrapTokenRevealBlock(
				tokenRevealIndex,
				`<div class="mermaid-placeholder" data-mermaid-code="${encodedCode}"></div>`
			);
		}

		if (shouldUsePierreFileView(token.content)) {
			const encodedCode = encodeURIComponent(token.content);
			const encodedLang = encodeURIComponent(lang);
			return wrapTokenRevealBlock(
				tokenRevealIndex,
				`<div class="pierre-file-placeholder" data-pierre-code="${encodedCode}" data-pierre-lang="${encodedLang}"></div>`
			);
		}

		let html: string;
		if (originalFence) {
			html = originalFence(tokens, idx, options, env, self);
		} else {
			html = self.renderToken(tokens, idx, options);
		}

		html = html.replace(/<pre\s/, "<pre data-scrollable ");

		// Wrap in container with copy button (top-right, visible on hover)
		// Icons match copy-button.svelte: Phosphor Copy (fill) + Tabler IconCheck (outline)
		const encodedCode = encodeURIComponent(token.content);
		const copyIcon = `<svg class="icon-copy" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32Zm-8,128H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>`;
		const checkIcon = `<svg class="icon-check" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>`;
		return wrapTokenRevealBlock(
			tokenRevealIndex,
			`<div class="code-block-wrapper" data-code="${encodedCode}"><button class="code-block-copy" aria-label="Copy code">${copyIcon}${checkIcon}</button>${html}</div>`
		);
	};
}

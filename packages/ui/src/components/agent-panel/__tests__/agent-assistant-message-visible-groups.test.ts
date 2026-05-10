import { expect, test } from "bun:test";

import {
	resolveVisibleAssistantMessageGroups,
	shouldStreamAssistantTextContent,
} from "../agent-assistant-message-visible-groups.js";

test("active token timing does not hide canonical text within the current text group", () => {
	const fullText =
		"The **Ahsoka** show takes place around **9 ABY**, which is about **5 years after *Return of the Jedi***.";
	const visibleGroups = resolveVisibleAssistantMessageGroups({
		messageGroups: [{ type: "text", text: fullText }],
		tokenRevealCss: {
			revealCount: 15,
			revealedCharCount: fullText.length,
			baselineMs: -64,
			tokStepMs: 32,
			tokFadeDurMs: 420,
			mode: "smooth",
		},
		lastMessageTextGroupIndex: 0,
	});

	expect(visibleGroups).toEqual([{ type: "text", text: fullText }]);
});

test("message groups keep full canonical text across adjacent groups", () => {
	const visibleGroups = resolveVisibleAssistantMessageGroups({
		messageGroups: [
			{ type: "text", text: "first " },
			{ type: "text", text: "second answer" },
		],
		lastMessageTextGroupIndex: 1,
	});

	expect(visibleGroups).toEqual([
		{ type: "text", text: "first " },
		{ type: "text", text: "second answer" },
	]);
});

test("settled rows keep trailing non-text groups visible", () => {
	const visibleGroups = resolveVisibleAssistantMessageGroups({
		messageGroups: [
			{ type: "text", text: "answer" },
			{ type: "other", block: { type: "resource", resource: { uri: "file://a" } } },
		],
		lastMessageTextGroupIndex: 0,
	});

	expect(visibleGroups).toEqual([
		{ type: "text", text: "answer" },
		{ type: "other", block: { type: "resource", resource: { uri: "file://a" } } },
	]);
});

test("active token timing hides trailing non-text groups until text settles", () => {
	const visibleGroups = resolveVisibleAssistantMessageGroups({
		messageGroups: [
			{ type: "text", text: "answer" },
			{ type: "other", block: { type: "resource", resource: { uri: "file://a" } } },
		],
		tokenRevealCss: {
			revealCount: 1,
			revealedCharCount: "answer".length,
			baselineMs: -32,
			tokStepMs: 32,
			tokFadeDurMs: 420,
			mode: "smooth",
		},
		lastMessageTextGroupIndex: 0,
	});

	expect(visibleGroups).toEqual([{ type: "text", text: "answer" }]);
});

test("assistant text content streams only while token timing is absent", () => {
	expect(
		shouldStreamAssistantTextContent({
			isStreaming: true,
			tokenRevealCss: {
				revealCount: 1,
				revealedCharCount: 5,
				baselineMs: -32,
				tokStepMs: 32,
				tokFadeDurMs: 420,
				mode: "smooth",
			},
		})
	).toBe(false);
	expect(shouldStreamAssistantTextContent({ isStreaming: true })).toBe(true);
	expect(shouldStreamAssistantTextContent({ isStreaming: false })).toBe(false);
});

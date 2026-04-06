import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sessionListPath = resolve(__dirname, "../session-list.svelte");
const sessionListUiPath = resolve(__dirname, "../session-list-ui.svelte");
const virtualizedSessionListPath = resolve(__dirname, "../virtualized-session-list.svelte");

const sessionListSource = readFileSync(sessionListPath, "utf8");
const sessionListUiSource = readFileSync(sessionListUiPath, "utf8");
const virtualizedSessionListSource = readFileSync(virtualizedSessionListPath, "utf8");

describe("session list inline rename forwarding", () => {
	it("threads onRenameSession through the list stack down to SessionItem", () => {
		expect(sessionListSource).toContain("onRenameSession");
		expect(sessionListSource).toContain("onRenameSession={onRenameSession}");
		expect(sessionListUiSource).toContain("onRenameSession");
		expect(sessionListUiSource).toContain("{onRenameSession}");
		expect(virtualizedSessionListSource).toContain("onRenameSession");
		expect(virtualizedSessionListSource).toContain(
			"onRename={onRenameSession ? (title) => onRenameSession(row.item, title) : undefined}"
		);
	});
});

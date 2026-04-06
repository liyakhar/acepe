import { okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
	api: {
		getSession: vi.fn(),
		scanSessions: vi.fn(),
		sendPrompt: vi.fn(),
		setSessionTitle: vi.fn(),
	},
}));

import { api } from "../api.js";
import { SessionStore } from "../session-store.svelte.js";

describe("SessionStore renameSession", () => {
	let store: SessionStore;

	beforeEach(() => {
		store = new SessionStore();
		vi.clearAllMocks();
	});

	it("persists a trimmed session title override without reordering the session", async () => {
		const updatedAt = new Date("2026-04-06T10:00:00.000Z");
		store.addSession({
			id: "session-rename-1",
			projectPath: "/project",
			agentId: "claude-code",
			title: "Original title",
			updatedAt,
			createdAt: new Date("2026-04-06T09:00:00.000Z"),
			parentId: null,
		});

		vi.mocked(api.setSessionTitle).mockReturnValue(okAsync(undefined));

		const result = await store.renameSession("session-rename-1", "  Renamed title  ");

		expect(result.isOk()).toBe(true);
		expect(api.setSessionTitle).toHaveBeenCalledWith("session-rename-1", "Renamed title");
		expect(store.getSessionCold("session-rename-1")?.title).toBe("Renamed title");
		expect(store.getSessionCold("session-rename-1")?.updatedAt.toISOString()).toBe(
			updatedAt.toISOString()
		);
	});
});

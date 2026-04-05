import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import type { SessionCold } from "../../../../application/dto/session.js";
import type { PanelStore } from "../../../../store/panel-store.svelte.js";
import type { SessionStore } from "../../../../store/session-store.svelte.js";
import { AgentInputState } from "../agent-input-state.svelte.js";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn(async () => () => {}),
}));

describe("AgentInputState - initial session title", () => {
	it("uses the first user prompt as the created session title", async () => {
		const createdSession: SessionCold = {
			id: "session-123",
			projectPath: "/tmp/project",
			agentId: "claude-code",
			title: "Build kanban parity",
			updatedAt: new Date(),
			createdAt: new Date(),
			sessionLifecycleState: "created",
			parentId: null,
		};
		const createSession = vi.fn(() => okAsync(createdSession));
		const sendMessage = vi.fn(() => okAsync(undefined));
		const getSessionCold = vi.fn(() => createdSession);
		const mockStore: Partial<SessionStore> = {
			createSession,
			sendMessage,
			getSessionCold,
		};
		const mockPanelStore: Partial<PanelStore> = {};
		const state = new AgentInputState(
			mockStore as SessionStore,
			mockPanelStore as PanelStore,
			() => "/tmp/project"
		);

		const result = await state.sendPreparedMessage({
			content: "Build kanban parity\n\nShow the title immediately.",
			projectPath: "/tmp/project",
			projectName: "Acepe",
			selectedAgentId: "claude-code",
		});

		expect(result.isOk()).toBe(true);
		expect(createSession).toHaveBeenCalledWith(
			expect.objectContaining({
				agentId: "claude-code",
				projectPath: "/tmp/project",
				title: "Build kanban parity",
			})
		);
		expect(sendMessage).toHaveBeenCalledWith(
			"session-123",
			"Build kanban parity\n\nShow the title immediately.",
			[]
		);
	});
});

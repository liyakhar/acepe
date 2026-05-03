import type { AgentPanelSceneEntryModel } from "@acepe/ui/agent-panel";
import { describe, expect, it } from "bun:test";

import {
	createAssistantTextRevealProjector,
	type AssistantTextRevealProjectionFacts,
} from "../assistant-text-reveal-projector.svelte.js";

function facts(
	turnState: AssistantTextRevealProjectionFacts["turnState"],
	activityKind: AssistantTextRevealProjectionFacts["activityKind"],
	lastAgentMessageId: string | null
): AssistantTextRevealProjectionFacts {
	return {
		sessionId: "session-1",
		turnState,
		activityKind,
		lastAgentMessageId,
	};
}

describe("AssistantTextRevealProjector", () => {
	it("decorates an assistant entry observed as canonical-live", () => {
		const projector = createAssistantTextRevealProjector();
		const entries: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "assistant-1", type: "assistant", markdown: "Partial", isStreaming: true },
		];

		const projected = projector.projectEntries(
			entries,
			facts("Running", "awaiting_model", "assistant-1")
		);

		expect(projected[1]?.type).toBe("assistant");
		if (projected[1]?.type === "assistant") {
			expect(projected[1].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-1:message",
			});
			expect(projected[1].isStreaming).toBe(true);
		}
	});

	it("keeps textRevealState after semantic streaming completes until reveal drains", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "Partial", isStreaming: true },
			],
			facts("Running", "awaiting_model", "assistant-1")
		);

		const projected = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{
					id: "assistant-1",
					type: "assistant",
					markdown: "The full completed answer",
					isStreaming: false,
				},
			],
			facts("Completed", "idle", "assistant-1")
		);

		expect(projected[1]?.type).toBe("assistant");
		if (projected[1]?.type === "assistant") {
			expect(projected[1].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-1:message",
			});
			expect(projected[1].isStreaming).toBe(false);
		}
	});

	it("does not decorate a cold completed assistant scene", () => {
		const projector = createAssistantTextRevealProjector();
		const projected = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "Historical answer", isStreaming: false },
			],
			facts("Completed", "idle", "assistant-1")
		);

		expect(projected[1]?.type).toBe("assistant");
		if (projected[1]?.type === "assistant") {
			expect(projected[1].textRevealState).toBeUndefined();
		}
	});

	it("binds a pending live turn to the first new assistant after completion", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "assistant-old", type: "assistant", markdown: "Earlier thought", isStreaming: false },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
			],
			facts("Running", "awaiting_model", null)
		);

		const projected = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "assistant-old", type: "assistant", markdown: "Earlier thought", isStreaming: false },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
				{ id: "assistant-new", type: "assistant", markdown: "Buffered final answer", isStreaming: false },
			],
			facts("Completed", "idle", null)
		);

		expect(projected[1]?.type).toBe("assistant");
		if (projected[1]?.type === "assistant") {
			expect(projected[1].textRevealState).toBeUndefined();
		}
		expect(projected[3]?.type).toBe("assistant");
		if (projected[3]?.type === "assistant") {
			expect(projected[3].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-new:message",
			});
		}
	});

	it("binds a pending live turn when the assistant appears before canonical lastAgentMessageId", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
			],
			facts("Running", "awaiting_model", null)
		);

		const projected = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "Prompt" },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
				{ id: "assistant-new", type: "assistant", markdown: "Live buffered answer", isStreaming: false },
			],
			facts("Running", "awaiting_model", null)
		);

		expect(projected[2]?.type).toBe("assistant");
		if (projected[2]?.type === "assistant") {
			expect(projected[2].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-new:message",
			});
		}
	});

	it("does not re-decorate a previous assistant when a newer user turn starts", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First answer", isStreaming: true },
			],
			facts("Running", "awaiting_model", "assistant-1")
		);

		const afterSecondUser = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First complete answer", isStreaming: false },
				{ id: "user-2", type: "user", text: "Second prompt" },
			],
			facts("Running", "awaiting_model", null)
		);

		expect(afterSecondUser[1]?.type).toBe("assistant");
		if (afterSecondUser[1]?.type === "assistant") {
			expect(afterSecondUser[1].textRevealState).toBeUndefined();
		}

		const withBufferedSecondAssistant = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First complete answer", isStreaming: false },
				{ id: "user-2", type: "user", text: "Second prompt" },
				{ id: "assistant-2", type: "assistant", markdown: "Second buffered answer", isStreaming: false },
			],
			facts("Completed", "idle", null)
		);

		expect(withBufferedSecondAssistant[3]?.type).toBe("assistant");
		if (withBufferedSecondAssistant[3]?.type === "assistant") {
			expect(withBufferedSecondAssistant[3].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-2:message",
			});
		}
	});

	it("does not re-decorate a previous assistant from stale lastAgentMessageId during the next live turn", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First answer", isStreaming: true },
			],
			facts("Running", "awaiting_model", "assistant-1")
		);

		const afterSecondUser = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First complete answer", isStreaming: false },
				{ id: "user-2", type: "user", text: "Second prompt" },
			],
			facts("Running", "awaiting_model", "assistant-1")
		);

		expect(afterSecondUser[1]?.type).toBe("assistant");
		if (afterSecondUser[1]?.type === "assistant") {
			expect(afterSecondUser[1].textRevealState).toBeUndefined();
		}

		const withBufferedSecondAssistant = projector.projectEntries(
			[
				{ id: "user-1", type: "user", text: "First prompt" },
				{ id: "assistant-1", type: "assistant", markdown: "First complete answer", isStreaming: false },
				{ id: "user-2", type: "user", text: "Second prompt" },
				{ id: "assistant-2", type: "assistant", markdown: "Second buffered answer", isStreaming: false },
			],
			facts("Running", "awaiting_model", "assistant-1")
		);

		expect(withBufferedSecondAssistant[1]?.type).toBe("assistant");
		if (withBufferedSecondAssistant[1]?.type === "assistant") {
			expect(withBufferedSecondAssistant[1].textRevealState).toBeUndefined();
		}
		expect(withBufferedSecondAssistant[3]?.type).toBe("assistant");
		if (withBufferedSecondAssistant[3]?.type === "assistant") {
			expect(withBufferedSecondAssistant[3].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-2:message",
			});
		}
	});

	it("binds a pending live turn with no user boundary without replaying known assistants", () => {
		const projector = createAssistantTextRevealProjector();
		projector.projectEntries(
			[
				{ id: "assistant-old", type: "assistant", markdown: "Earlier answer", isStreaming: false },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
			],
			facts("Running", "awaiting_model", null)
		);

		const projected = projector.projectEntries(
			[
				{ id: "assistant-old", type: "assistant", markdown: "Earlier answer", isStreaming: false },
				{ id: "tool-1", type: "tool_call", title: "Run", status: "done" },
				{ id: "assistant-new", type: "assistant", markdown: "First live answer", isStreaming: false },
			],
			facts("Running", "awaiting_model", null)
		);

		expect(projected[0]?.type).toBe("assistant");
		if (projected[0]?.type === "assistant") {
			expect(projected[0].textRevealState).toBeUndefined();
		}
		expect(projected[2]?.type).toBe("assistant");
		if (projected[2]?.type === "assistant") {
			expect(projected[2].textRevealState).toEqual({
				policy: "pace",
				key: "session-1:assistant-new:message",
			});
		}
	});

	it("clears reveal state when the child reports inactive", () => {
		let notifications = 0;
		const projector = createAssistantTextRevealProjector(() => {
			notifications += 1;
		});
		const liveEntries: AgentPanelSceneEntryModel[] = [
			{ id: "user-1", type: "user", text: "Prompt" },
			{ id: "assistant-1", type: "assistant", markdown: "Answer", isStreaming: true },
		];
		projector.projectEntries(liveEntries, facts("Running", "awaiting_model", "assistant-1"));
		projector.handleRevealActivityChange("session-1:assistant-1:message", false);

		const projected = projector.projectEntries(liveEntries, facts("Running", "awaiting_model", null));

		expect(notifications).toBe(1);
		expect(projected[1]?.type).toBe("assistant");
		if (projected[1]?.type === "assistant") {
			expect(projected[1].textRevealState).toBeUndefined();
		}
	});
});

import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentError } from "$lib/acp/errors/app-error.js";
import type { AvailableCommand } from "$lib/acp/types/available-command.js";
import {
	PreconnectionRemoteCommandsState,
	shouldLoadRemotePreconnectionCommands,
} from "./preconnection-remote-commands-state.svelte.js";

function makeCommand(name: string, description: string): AvailableCommand {
	return {
		name,
		description,
	};
}

describe("PreconnectionRemoteCommandsState", () => {
	const fetchFn = vi.fn();

	beforeEach(() => {
		fetchFn.mockReset();
	});

	it("loads OpenCode commands for a project before a session exists", async () => {
		fetchFn.mockReturnValueOnce(
			okAsync([makeCommand("compact", "compact the session")])
		);

		const state = new PreconnectionRemoteCommandsState(fetchFn);
		const result = await state.ensureLoaded({
			agentId: "opencode",
			hasConnectedSession: false,
			projectPath: "/repo",
		});

		expect(result.isOk()).toBe(true);
		expect(fetchFn).toHaveBeenCalledWith("/repo", "opencode");
		expect(
			state.getCommands({
				agentId: "opencode",
				projectPath: "/repo",
				skillCommands: [makeCommand("ce:brainstorm", "Brainstorm")],
			})
		).toEqual([makeCommand("compact", "compact the session")]);
	});

	it("falls back to skill commands for non-OpenCode agents", async () => {
		const state = new PreconnectionRemoteCommandsState(fetchFn);
		const skillCommands = [makeCommand("ce:brainstorm", "Brainstorm")];

		const result = await state.ensureLoaded({
			agentId: "claude-code",
			hasConnectedSession: false,
			projectPath: "/repo",
		});

		expect(result.isOk()).toBe(true);
		expect(fetchFn).not.toHaveBeenCalled();
		expect(
			state.getCommands({
				agentId: "claude-code",
				projectPath: "/repo",
				skillCommands,
			})
		).toEqual(skillCommands);
	});

	it("does not refetch OpenCode commands when the same project is already loaded", async () => {
		fetchFn.mockReturnValue(
			okAsync([makeCommand("compact", "compact the session")])
		);

		const state = new PreconnectionRemoteCommandsState(fetchFn);
		await state.ensureLoaded({
			agentId: "opencode",
			hasConnectedSession: false,
			projectPath: "/repo",
		});

		const second = await state.ensureLoaded({
			agentId: "opencode",
			hasConnectedSession: false,
			projectPath: "/repo",
		});

		expect(second.isOk()).toBe(true);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it("clears the loading marker after a fetch failure", async () => {
		fetchFn.mockReturnValueOnce(
			errAsync(new AgentError("acp_list_preconnection_commands", new Error("boom")))
		);

		const state = new PreconnectionRemoteCommandsState(fetchFn);
		const result = await state.ensureLoaded({
			agentId: "opencode",
			hasConnectedSession: false,
			projectPath: "/repo",
		});

		expect(result.isErr()).toBe(true);
		expect(state.loadingProjectPath).toBeNull();
	});
});

describe("shouldLoadRemotePreconnectionCommands", () => {
	it("only loads for OpenCode before connection when a project path is present", () => {
		expect(
			shouldLoadRemotePreconnectionCommands({
				agentId: "opencode",
				hasConnectedSession: false,
				projectPath: "/repo",
				loadedProjectPath: null,
				loadingProjectPath: null,
			})
		).toBe(true);

		expect(
			shouldLoadRemotePreconnectionCommands({
				agentId: "opencode",
				hasConnectedSession: true,
				projectPath: "/repo",
				loadedProjectPath: null,
				loadingProjectPath: null,
			})
		).toBe(false);

		expect(
			shouldLoadRemotePreconnectionCommands({
				agentId: "claude-code",
				hasConnectedSession: false,
				projectPath: "/repo",
				loadedProjectPath: null,
				loadingProjectPath: null,
			})
		).toBe(false);
	});
});
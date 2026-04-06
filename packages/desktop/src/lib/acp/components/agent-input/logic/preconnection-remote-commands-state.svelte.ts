import { okAsync, type ResultAsync } from "neverthrow";
import { getAgentCapabilities } from "$lib/acp/constants/agent-capabilities.js";
import { tauriClient } from "$lib/utils/tauri-client.js";
import type { AppError } from "$lib/acp/errors/app-error.js";
import type { AvailableCommand } from "$lib/acp/types/available-command.js";
import { createLogger } from "$lib/acp/utils/logger.js";

interface EnsureLoadedInput {
	agentId: string | null;
	hasConnectedSession: boolean;
	projectPath: string | null;
}

interface GetCommandsInput {
	agentId: string | null;
	projectPath: string | null;
	skillCommands: ReadonlyArray<AvailableCommand>;
}

type FetchRemoteCommands = (
	projectPath: string,
	agentId: string
) => ResultAsync<AvailableCommand[], AppError>;

const logger = createLogger({
	id: "preconnection-remote-commands",
	name: "PreconnectionRemoteCommands",
});

export function shouldLoadRemotePreconnectionCommands(input: {
	agentId: string | null;
	hasConnectedSession: boolean;
	projectPath: string | null;
	loadedProjectPath: string | null;
	loadingProjectPath: string | null;
}): boolean {
	if (!getAgentCapabilities(input.agentId).loadsRemotePreconnectionCommands) {
		return false;
	}

	if (input.hasConnectedSession) {
		return false;
	}

	if (!input.projectPath) {
		return false;
	}

	if (input.loadedProjectPath === input.projectPath) {
		return false;
	}

	if (input.loadingProjectPath === input.projectPath) {
		return false;
	}

	return true;
}

export class PreconnectionRemoteCommandsState {
	loadedProjectPath = $state<string | null>(null);
	loadingProjectPath = $state<string | null>(null);
	private remoteCommands = $state<AvailableCommand[]>([]);
	private readonly fetchRemoteCommands: FetchRemoteCommands;

	constructor(fetchRemoteCommands?: FetchRemoteCommands) {
		this.fetchRemoteCommands =
			fetchRemoteCommands ? fetchRemoteCommands : tauriClient.acp.listPreconnectionCommands;
	}

	ensureLoaded(input: EnsureLoadedInput): ResultAsync<void, AppError> {
		if (
			!shouldLoadRemotePreconnectionCommands({
				agentId: input.agentId,
				hasConnectedSession: input.hasConnectedSession,
				projectPath: input.projectPath,
				loadedProjectPath: this.loadedProjectPath,
				loadingProjectPath: this.loadingProjectPath,
			})
		) {
			return okAsync(undefined);
		}

		const projectPath = input.projectPath;
		if (!projectPath) {
			return okAsync(undefined);
		}

		const agentId = input.agentId;
		if (!agentId) {
			return okAsync(undefined);
		}

		logger.info("Loading remote preconnection commands", {
			agentId,
			projectPath,
		});
		this.loadingProjectPath = projectPath;

		return this.fetchRemoteCommands(projectPath, agentId)
			.map((commands) => {
				logger.info("Loaded remote preconnection commands", {
					agentId,
					projectPath,
					count: commands.length,
					commandNames: commands.map((command) => command.name),
				});
				this.remoteCommands = commands;
				this.loadedProjectPath = projectPath;
				if (this.loadingProjectPath === projectPath) {
					this.loadingProjectPath = null;
				}
			})
			.mapErr((error) => {
				logger.error("Failed to load remote preconnection commands", {
					agentId,
					projectPath,
					error: error.message,
				});
				if (this.loadingProjectPath === projectPath) {
					this.loadingProjectPath = null;
				}
				return error;
			});
	}

	getCommands(input: GetCommandsInput): AvailableCommand[] {
		if (
			getAgentCapabilities(input.agentId).loadsRemotePreconnectionCommands &&
			input.projectPath &&
			input.projectPath === this.loadedProjectPath
		) {
			return Array.from(this.remoteCommands);
		}

		return Array.from(input.skillCommands);
	}
}

import type { SessionOpenResult } from "../../services/acp-types.js";
import type { SessionId } from "./session-id.js";
import type { SessionModelState } from "./session-model-state.js";
import type { SessionModes } from "./session-modes.js";

/**
 * Response from the session/new ACP protocol method.
 *
 * Contains either a provider-canonical completed session id, or a provider
 * routing id for a deferred creation attempt that is promoted on first stream
 * identity evidence.
 *
 * @see https://agentclientprotocol.com/protocol/#sessionnew
 */
export type NewSessionResponse = {
	/**
	 * Provider-owned session identifier. For deferred creation this is the
	 * provider id requested by Acepe and must not be treated as a completed
	 * product session until canonical promotion succeeds.
	 */
	sessionId: SessionId;
	creationAttemptId?: string | null;
	deferredCreation?: boolean;
	sequenceId?: number | null;
	sessionOpen?: SessionOpenResult | null;

	/**
	 * Model state for this session.
	 */
	models: SessionModelState;

	/**
	 * Mode state for this session.
	 */
	modes: SessionModes;
};

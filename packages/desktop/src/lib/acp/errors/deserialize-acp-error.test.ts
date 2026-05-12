import { describe, expect, it } from "vitest";

import {
	CreationFailedAcpError,
	ProviderHistoryFailedAcpError,
} from "./acp-error.js";
import { deserializeAcpError } from "./deserialize-acp-error.js";

describe("deserializeAcpError", () => {
	it("preserves typed creation failure fields", () => {
		const error = deserializeAcpError({
			type: "creation_failed",
			data: {
				kind: "provider_failed_before_id",
				message: "Provider failed before creating a session id",
				sessionId: "session-1",
				creationAttemptId: "attempt-1",
				retryable: true,
			},
		});

		expect(error).toBeInstanceOf(CreationFailedAcpError);
		if (!(error instanceof CreationFailedAcpError)) {
			throw new Error("Expected CreationFailedAcpError");
		}
		expect(error.kind).toBe("provider_failed_before_id");
		expect(error.sessionId).toBe("session-1");
		expect(error.creationAttemptId).toBe("attempt-1");
		expect(error.retryable).toBe(true);
	});

	it("preserves typed provider history failure fields", () => {
		const error = deserializeAcpError({
			type: "provider_history_failed",
			data: {
				kind: "provider_history_missing",
				message: "Provider history is missing",
				sessionId: "session-1",
				retryable: false,
			},
		});

		expect(error).toBeInstanceOf(ProviderHistoryFailedAcpError);
		if (!(error instanceof ProviderHistoryFailedAcpError)) {
			throw new Error("Expected ProviderHistoryFailedAcpError");
		}
		expect(error.kind).toBe("provider_history_missing");
		expect(error.sessionId).toBe("session-1");
		expect(error.retryable).toBe(false);
	});
});

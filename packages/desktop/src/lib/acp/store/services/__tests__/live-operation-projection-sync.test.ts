import { beforeEach, describe, expect, it, mock } from "bun:test";
import { okAsync } from "neverthrow";
import type { SessionDomainEvent } from "../../../../services/acp-types.js";
import { LiveOperationProjectionSync } from "../live-operation-projection-sync.js";

describe("LiveOperationProjectionSync", () => {
	let listener: ((event: SessionDomainEvent) => void) | null;
	const subscribeMock = mock((nextListener: (event: SessionDomainEvent) => void) => {
		listener = nextListener;
		return okAsync("listener-1");
	});
	const unsubscribeByIdMock = mock(() => {});
	const hydrateSessionMock = mock(() => okAsync(undefined));

	beforeEach(() => {
		listener = null;
		subscribeMock.mockClear();
		unsubscribeByIdMock.mockClear();
		hydrateSessionMock.mockClear();
	});

	it("hydrates the session projection for operation lifecycle events", async () => {
		const sync = new LiveOperationProjectionSync(
			{ subscribe: subscribeMock, unsubscribeById: unsubscribeByIdMock },
			{ hydrateSession: hydrateSessionMock }
		);

		const result = await sync.start();

		expect(result.isOk()).toBe(true);
		expect(listener).not.toBeNull();
		listener?.(createEvent("operation_upserted"));
		listener?.(createEvent("operation_completed"));
		listener?.(createEvent("operation_child_linked"));

		expect(hydrateSessionMock).toHaveBeenCalledTimes(3);
		expect(hydrateSessionMock).toHaveBeenCalledWith("session-1");
	});

	it("ignores non-operation domain events", async () => {
		const sync = new LiveOperationProjectionSync(
			{ subscribe: subscribeMock, unsubscribeById: unsubscribeByIdMock },
			{ hydrateSession: hydrateSessionMock }
		);

		await sync.start();
		listener?.(createEvent("turn_completed"));
		listener?.(createEvent("interaction_upserted"));
		listener?.(createEvent("session_connected"));

		expect(hydrateSessionMock).not.toHaveBeenCalled();
	});

	it("does not re-subscribe when already started", async () => {
		const sync = new LiveOperationProjectionSync(
			{ subscribe: subscribeMock, unsubscribeById: unsubscribeByIdMock },
			{ hydrateSession: hydrateSessionMock }
		);

		await sync.start();
		await sync.start();

		expect(subscribeMock).toHaveBeenCalledTimes(1);
	});

	it("unsubscribes when stopped", async () => {
		const sync = new LiveOperationProjectionSync(
			{ subscribe: subscribeMock, unsubscribeById: unsubscribeByIdMock },
			{ hydrateSession: hydrateSessionMock }
		);

		await sync.start();
		sync.stop();

		expect(unsubscribeByIdMock).toHaveBeenCalledWith("listener-1");
	});

	it("re-subscribes and hydrates after stop + restart (reconnect scenario)", async () => {
		const sync = new LiveOperationProjectionSync(
			{ subscribe: subscribeMock, unsubscribeById: unsubscribeByIdMock },
			{ hydrateSession: hydrateSessionMock }
		);

		await sync.start();
		listener?.(createEvent("operation_upserted"));
		expect(hydrateSessionMock).toHaveBeenCalledTimes(1);

		sync.stop();
		hydrateSessionMock.mockClear();

		await sync.start();
		listener?.(createEvent("operation_upserted"));
		listener?.(createEvent("operation_completed"));

		expect(hydrateSessionMock).toHaveBeenCalledTimes(2);
	});
});

function createEvent(kind: SessionDomainEvent["kind"]): SessionDomainEvent {
	return {
		event_id: "event-1",
		seq: 1,
		session_id: "session-1",
		provider_session_id: null,
		occurred_at_ms: 1,
		causation_id: null,
		kind,
	};
}

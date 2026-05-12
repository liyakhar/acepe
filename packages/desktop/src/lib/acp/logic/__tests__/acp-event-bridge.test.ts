import { describe, expect, it, vi } from "vitest";
import type { AcpEventEnvelope } from "../acp-event-bridge.js";
import { createAcpEventDrain } from "../acp-event-bridge.js";

function createEnvelope(seq: number): AcpEventEnvelope {
	return {
		seq,
		eventName: "acp-session-state",
		sessionId: "session-1",
		payload: {
			sessionId: "session-1",
			graphRevision: seq,
			lastEventSeq: seq,
			payload: { kind: "snapshot" },
		},
		priority: "normal",
		droppable: false,
		emittedAtMs: seq,
	};
}

describe("createAcpEventDrain", () => {
	it("yields between event batches so SSE bursts do not monopolize the renderer", () => {
		const processed: number[] = [];
		const scheduled: Array<() => void> = [];
		const enqueue = createAcpEventDrain((envelope) => processed.push(envelope.seq), {
			maxBatchSize: 2,
			maxBatchMs: 100,
			now: () => 0,
			schedule: (callback) => scheduled.push(callback),
		});

		enqueue(createEnvelope(1));
		enqueue(createEnvelope(2));
		enqueue(createEnvelope(3));
		enqueue(createEnvelope(4));
		enqueue(createEnvelope(5));

		expect(processed).toEqual([]);
		expect(scheduled).toHaveLength(1);

		scheduled.shift()?.();
		expect(processed).toEqual([1, 2]);
		expect(scheduled).toHaveLength(1);

		scheduled.shift()?.();
		expect(processed).toEqual([1, 2, 3, 4]);
		expect(scheduled).toHaveLength(1);

		scheduled.shift()?.();
		expect(processed).toEqual([1, 2, 3, 4, 5]);
		expect(scheduled).toHaveLength(0);
	});

	it("schedules only one drain while events are already queued", () => {
		const processed: number[] = [];
		const schedule = vi.fn();
		const enqueue = createAcpEventDrain((envelope) => processed.push(envelope.seq), {
			maxBatchSize: 12,
			maxBatchMs: 100,
			now: () => 0,
			schedule,
		});

		enqueue(createEnvelope(1));
		enqueue(createEnvelope(2));
		enqueue(createEnvelope(3));

		expect(processed).toEqual([]);
		expect(schedule).toHaveBeenCalledTimes(1);
	});
});

import { mock } from "bun:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelStore } from "../../../../store/panel-store.svelte.js";
import type { SessionStore } from "../../../../store/session-store.svelte.js";

const listenMock = vi.fn();
const invokeMock = vi.fn();

let AgentInputState: typeof import("../agent-input-state.svelte.js").AgentInputState;

function createPendingPromise<T>() {
	let resolveValue: ((value: T) => void) | null = null;
	const promise = new Promise<T>((resolve) => {
		resolveValue = resolve;
	});

	return {
		promise,
		resolve(value: T) {
			if (resolveValue) {
				resolveValue(value);
			}
		},
	};
}

async function flushAsync(times = 10): Promise<void> {
	for (let index = 0; index < times; index += 1) {
		await Promise.resolve();
	}
}

describe("AgentInputState drag-drop listener lifecycle", () => {
	beforeEach(async () => {
		listenMock.mockReset();
		invokeMock.mockReset();

		mock.module("@tauri-apps/api/core", () => ({
			invoke: invokeMock,
		}));
		mock.module("@tauri-apps/api/event", () => ({
			listen: listenMock,
		}));

		({ AgentInputState } = await import("../agent-input-state.svelte.js"));
	});

	it("cleans up listeners that finish registering after destroy", async () => {
		const hoverRegistration = createPendingPromise<() => void>();
		const dropRegistration = createPendingPromise<() => void>();
		const leaveRegistration = createPendingPromise<() => void>();
		const unlistenHover = vi.fn();
		const unlistenDrop = vi.fn();
		const unlistenLeave = vi.fn();

		listenMock
			.mockReturnValueOnce(hoverRegistration.promise)
			.mockReturnValueOnce(dropRegistration.promise)
			.mockReturnValueOnce(leaveRegistration.promise);

		const state = new AgentInputState({} as SessionStore, {} as PanelStore);
		state.initialize();

		hoverRegistration.resolve(unlistenHover);
		await flushAsync();

		state.destroy();

		expect(unlistenHover).toHaveBeenCalledTimes(1);

		dropRegistration.resolve(unlistenDrop);
		await flushAsync();

		leaveRegistration.resolve(unlistenLeave);
		await flushAsync();

		expect(unlistenDrop).toHaveBeenCalledTimes(1);
		expect(unlistenLeave).toHaveBeenCalledTimes(1);
	});
});
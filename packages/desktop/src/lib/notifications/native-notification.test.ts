import { describe, expect, it, mock } from "bun:test";

const invokeMock = mock(async () => undefined);

mock.module("@tauri-apps/api/core", () => ({
	invoke: invokeMock,
}));

import { sendNativeNotification } from "./native-notification.js";

describe("native-notification", () => {
	it("routes notification delivery through the Tauri plugin invoke command", async () => {
		const result = await sendNativeNotification({
			title: "Task Complete",
			body: "Agent finished work",
		});

		expect(result.isOk()).toBe(true);
		expect(invokeMock).toHaveBeenCalledWith("plugin:notification|notify", {
			options: {
				title: "Task Complete",
				body: "Agent finished work",
			},
		});
	});
});

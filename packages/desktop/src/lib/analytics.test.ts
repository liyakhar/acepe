import { beforeEach, describe, expect, it, mock } from "bun:test";

const getMock = mock(() => ({ match: (ok: (value: boolean | null) => boolean) => ok(null) }));
const sentryInitMock = mock(() => undefined);
const sentrySetUserMock = mock(() => undefined);
const sentryWithScopeMock = mock((callback: (scope: { setExtra: (key: string, value: unknown) => void }) => void) => {
	callback({
		setExtra: () => undefined,
	});
});
const sentryCaptureExceptionMock = mock(() => undefined);
const posthogInitMock = mock(() => undefined);
const posthogIdentifyMock = mock(() => undefined);
const posthogCaptureMock = mock(() => undefined);
const posthogOptInMock = mock(() => undefined);
const posthogOptOutMock = mock(() => undefined);
const getVersionMock = mock(async () => "1.2.3");

const storage = new Map<string, string>();

mock.module("$lib/acp/utils/logger.js", () => ({
	createLogger: () => ({
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
	}),
}));

mock.module("$lib/utils/tauri-client/settings.js", () => ({
	settings: {
		get: getMock,
	},
}));

mock.module("@tauri-apps/api/app", () => ({
	getVersion: getVersionMock,
}));

mock.module("@sentry/browser", () => ({
	init: sentryInitMock,
	setUser: sentrySetUserMock,
	withScope: sentryWithScopeMock,
	captureException: sentryCaptureExceptionMock,
}));

mock.module("posthog-js", () => ({
	default: {
		init: posthogInitMock,
		identify: posthogIdentifyMock,
		capture: posthogCaptureMock,
		opt_in_capturing: posthogOptInMock,
		opt_out_capturing: posthogOptOutMock,
	},
}));

import {
	__resetAnalyticsForTests,
	captureException,
	initAnalytics,
	setAnalyticsEnabled,
} from "./analytics.js";

describe("analytics", () => {
	beforeEach(() => {
		__resetAnalyticsForTests();
		getMock.mockReset();
		sentryInitMock.mockReset();
		sentrySetUserMock.mockReset();
		sentryWithScopeMock.mockReset();
		sentryCaptureExceptionMock.mockReset();
		posthogInitMock.mockReset();
		posthogIdentifyMock.mockReset();
		posthogCaptureMock.mockReset();
		posthogOptInMock.mockReset();
		posthogOptOutMock.mockReset();
		getVersionMock.mockReset();
		getVersionMock.mockResolvedValue("1.2.3");
		sentryWithScopeMock.mockImplementation(
			(callback: (scope: { setExtra: (key: string, value: unknown) => void }) => void) => {
				callback({
					setExtra: () => undefined,
				});
			}
		);
		getMock.mockReturnValue({ match: (ok: (value: boolean | null) => boolean) => ok(null) });
		storage.clear();
		Object.assign(import.meta.env, {
			DEV: false,
			VITE_FORCE_ANALYTICS: "1",
			VITE_POSTHOG_KEY: "",
			VITE_SENTRY_DSN: "",
		});
		Object.defineProperty(globalThis, "window", {
			value: globalThis,
			configurable: true,
		});
		Object.defineProperty(globalThis, "localStorage", {
			value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			},
			key: (index: number) => Array.from(storage.keys())[index] ?? null,
			get length() {
				return storage.size;
			},
			} satisfies Storage,
			configurable: true,
		});
	});

	it("initializes providers and captures app_opened when enabled", async () => {
		import.meta.env.VITE_POSTHOG_KEY = "ph_test";
		import.meta.env.VITE_SENTRY_DSN = "https://example@sentry.io/123";

		await initAnalytics();

		expect(sentryInitMock).toHaveBeenCalled();
		expect(posthogInitMock).toHaveBeenCalled();
		expect(posthogIdentifyMock).toHaveBeenCalled();
		expect(posthogCaptureMock).toHaveBeenCalledWith("app_opened", { appVersion: "1.2.3" });
	});

	it("does not capture events when opted out", async () => {
		import.meta.env.VITE_POSTHOG_KEY = "ph_test";
		getMock.mockReturnValue({ match: (ok: (value: boolean | null) => boolean) => ok(true) });

		await initAnalytics();

		expect(posthogCaptureMock).not.toHaveBeenCalled();
	});

	it("captures exceptions after initialization", async () => {
		import.meta.env.VITE_SENTRY_DSN = "https://example@sentry.io/123";

		await initAnalytics();
		captureException(new Error("boom"), { source: "test" });

		expect(sentryCaptureExceptionMock).toHaveBeenCalled();
	});

	it("updates posthog capture state when toggled", async () => {
		import.meta.env.VITE_POSTHOG_KEY = "ph_test";

		await initAnalytics();
		await setAnalyticsEnabled(false);
		await setAnalyticsEnabled(true);

		expect(posthogOptOutMock).toHaveBeenCalled();
		expect(posthogOptInMock).toHaveBeenCalled();
	});
});

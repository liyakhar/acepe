import * as Sentry from "@sentry/browser";
import posthog from "posthog-js";
import { ResultAsync } from "neverthrow";
import { createLogger } from "$lib/acp/utils/logger.js";
import type { UserSettingKey } from "$lib/services/converted-session-types.js";
import { settings } from "$lib/utils/tauri-client/settings.js";

const ANALYTICS_OPT_OUT_KEY: UserSettingKey = "analytics_opt_out";
const DEVICE_ID_STORAGE_KEY = "analytics_device_id";
const APP_OPENED_EVENT = "app_opened";
const POSTHOG_API_HOST = "https://us.i.posthog.com";

const logger = createLogger({
	id: "analytics",
	name: "Analytics",
});

let analyticsEnabled = true;
let analyticsInitialized = false;
let sentryInitialized = false;
let posthogInitialized = false;
let distinctId: string | null = null;
let appVersion: string | null = null;

function isBrowser(): boolean {
	return typeof window !== "undefined";
}

function normalizeError(error: unknown, fallback: string): Error {
	if (error instanceof Error) {
		return error;
	}

	const detail = error === undefined ? "" : `: ${String(error)}`;
	return new Error(`${fallback}${detail}`);
}

function shouldEnableAnalyticsInThisBuild(): boolean {
	return !import.meta.env.DEV || import.meta.env.VITE_FORCE_ANALYTICS === "1";
}

function readDistinctId(): string {
	if (!isBrowser()) {
		return "server";
	}

	if (distinctId !== null) {
		return distinctId;
	}

	const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
	if (existing && existing.length > 0) {
		distinctId = existing;
		return existing;
	}

	const created = crypto.randomUUID();
	window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
	distinctId = created;
	return created;
}

async function readAppVersion(): Promise<string | null> {
	if (appVersion !== null) {
		return appVersion;
	}

	return ResultAsync.fromPromise(
		import("@tauri-apps/api/app").then((mod) => mod.getVersion()),
		(error) => normalizeError(error, "Failed to load app version")
	).match(
		(version) => {
			appVersion = version;
			return version;
		},
		(error) => {
			logger.warn("Unable to resolve app version for analytics", { error });
			return null;
		}
	);
}

async function readAnalyticsEnabledPreference(): Promise<boolean> {
	return settings.get<boolean>(ANALYTICS_OPT_OUT_KEY).match(
		(value) => !(value ?? false),
		(error) => {
			logger.warn("Failed to load analytics preference", { error });
			return true;
		}
	);
}

function syncIdentity(): void {
	const id = readDistinctId();

	if (sentryInitialized) {
		Sentry.setUser({ id });
	}

	if (posthogInitialized && analyticsEnabled) {
		posthog.identify(id);
	}
}

async function initializeSentry(version: string | null): Promise<void> {
	if (sentryInitialized) {
		return;
	}

	const dsn = import.meta.env.VITE_SENTRY_DSN;
	if (!dsn) {
		return;
	}

	await ResultAsync.fromPromise(
		Promise.resolve().then(() => {
			Sentry.init({
				dsn,
				defaultIntegrations: false,
				sendDefaultPii: false,
				tracesSampleRate: 0.1,
				environment: import.meta.env.DEV ? "development" : "production",
				release: version ? `acepe@${version}` : undefined,
				beforeSend: analyticsEnabled ? undefined : () => null,
			});
		}),
		(error) => normalizeError(error, "Failed to initialize Sentry")
	).match(
		() => {
			sentryInitialized = true;
			syncIdentity();
		},
		(error) => {
			logger.warn("Sentry initialization failed", { error });
		}
	);
}

async function initializePostHog(version: string | null): Promise<void> {
	if (posthogInitialized) {
		return;
	}

	const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
	if (!posthogKey) {
		return;
	}

	await ResultAsync.fromPromise(
		Promise.resolve().then(() => {
			posthog.init(posthogKey, {
				api_host: POSTHOG_API_HOST,
				autocapture: false,
				capture_pageview: false,
				disable_session_recording: true,
				persistence: "localStorage",
				opt_out_capturing_by_default: !analyticsEnabled,
			});
		}),
		(error) => normalizeError(error, "Failed to initialize PostHog")
	).match(
		() => {
			posthogInitialized = true;
			syncIdentity();
			if (analyticsEnabled) {
				posthog.capture(APP_OPENED_EVENT, version ? { appVersion: version } : {});
			}
		},
		(error) => {
			logger.warn("PostHog initialization failed", { error });
		}
	);
}

export async function initAnalytics(): Promise<void> {
	if (!isBrowser() || analyticsInitialized) {
		return;
	}

	analyticsInitialized = true;

	if (!shouldEnableAnalyticsInThisBuild()) {
		logger.info("Analytics disabled in development build");
		return;
	}

	analyticsEnabled = await readAnalyticsEnabledPreference();
	readDistinctId();

	const version = await readAppVersion();
	await initializeSentry(version);
	await initializePostHog(version);
}

export function captureEvent(event: string, properties: Record<string, unknown> = {}): void {
	if (!analyticsEnabled || !posthogInitialized) {
		return;
	}

	ResultAsync.fromPromise(
		Promise.resolve().then(() => {
			posthog.capture(event, properties);
		}),
		(error) => normalizeError(error, `Failed to capture PostHog event ${event}`)
	).mapErr((error) => {
		logger.warn("Analytics event capture failed", { event, error });
	});
}

export function captureException(error: unknown, context: Record<string, unknown> = {}): void {
	if (!analyticsEnabled || !sentryInitialized) {
		return;
	}

	const err = normalizeError(error, "Unknown analytics exception");
	Sentry.withScope((scope) => {
		for (const [key, value] of Object.entries(context)) {
			scope.setExtra(key, value);
		}
		Sentry.captureException(err);
	});
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
	analyticsEnabled = enabled;

	if (!shouldEnableAnalyticsInThisBuild()) {
		return;
	}

	if (!analyticsInitialized) {
		await initAnalytics();
		// initAnalytics() reads the persisted preference and may have overwritten
		// analyticsEnabled; re-apply the caller's intent here.
		analyticsEnabled = enabled;
	}

	if (!posthogInitialized) {
		return;
	}

	await ResultAsync.fromPromise(
		Promise.resolve().then(() => {
			if (enabled) {
				posthog.opt_in_capturing();
				syncIdentity();
				posthog.capture(APP_OPENED_EVENT, appVersion ? { appVersion } : {});
				return;
			}

			posthog.opt_out_capturing();
		}),
		(error) => normalizeError(error, "Failed to update PostHog preference")
	).match(
		() => undefined,
		(error) => {
			logger.warn("Failed to apply analytics preference", { error, enabled });
		}
	);
}

export function isAnalyticsEnabled(): boolean {
	return analyticsEnabled;
}

export function __resetAnalyticsForTests(): void {
	analyticsEnabled = true;
	analyticsInitialized = false;
	sentryInitialized = false;
	posthogInitialized = false;
	distinctId = null;
	appVersion = null;
}

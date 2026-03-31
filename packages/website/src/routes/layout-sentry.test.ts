import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryInit = vi.fn();
const sentryReplayIntegration = vi.fn(() => ({ name: 'replay' }));

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_SENTRY_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0'
	}
}));

vi.mock('@sentry/sveltekit', () => ({
	browserTracingIntegration: () => ({ name: 'browser-tracing' }),
	init: sentryInit,
	replayIntegration: sentryReplayIntegration
}));

describe('website Sentry layout init', () => {
	beforeEach(() => {
		sentryInit.mockClear();
		sentryReplayIntegration.mockClear();
	});

	afterEach(() => {
		vi.resetModules();
	});

	it('initializes Sentry without Replay integration', async () => {
		const { load } = await import('./+layout');

		await load({ data: { ok: true } } as never);

		expect(sentryReplayIntegration).not.toHaveBeenCalled();
		expect(sentryInit).toHaveBeenCalledWith(
			expect.objectContaining({
				integrations: [{ name: 'browser-tracing' }]
			})
		);
		expect(sentryInit).toHaveBeenCalledWith(
			expect.not.objectContaining({
				replaysOnErrorSampleRate: expect.anything(),
				replaysSessionSampleRate: expect.anything()
			})
		);
	});
});
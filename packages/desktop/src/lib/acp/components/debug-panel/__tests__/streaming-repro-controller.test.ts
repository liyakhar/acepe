import { describe, expect, it, vi } from "vitest";

import {
	createStreamingReproController,
	type StreamingReproAnswer,
} from "../streaming-repro-controller";

describe("streaming-repro-controller", () => {
	it("starts at the first phase of the requested preset", () => {
		const controller = createStreamingReproController({
			now: () => 1_000,
			hostMetrics: { width: 1280, height: 820 },
			theme: "dark",
		});

		expect(controller.activePreset.id).toBe("core-streaming");
		expect(controller.activePhase.id).toBe("thinking-only");
		expect(controller.phaseIndex).toBe(0);
		expect(controller.isAutoplaying).toBe(false);
	});

	it("can target the first-word regression preset", () => {
		const controller = createStreamingReproController({
			now: () => 1_000,
			hostMetrics: { width: 1280, height: 820 },
			theme: "dark",
			defaultPresetId: "first-word-regression",
		});

		expect(controller.activePreset.id).toBe("first-word-regression");
		expect(controller.activePhase.id).toBe("first-word");

		controller.nextPhase();

		expect(controller.activePhase.id).toBe("same-id-full-rewrite");
		expect(controller.activePhase.assistantText).toContain("fully visible");
	});

	it("ships every required reveal QA preset", () => {
		const controller = createStreamingReproController({
			now: () => 1_000,
			hostMetrics: { width: 1280, height: 820 },
			theme: "dark",
		});

		expect(controller.presets.map((preset) => preset.id)).toEqual([
			"core-streaming",
			"first-word-regression",
			"final-step-fade",
			"completion-snap-fade",
			"restored-completed-history",
			"reduced-motion",
			"instant-mode",
			"same-key-rewrite",
			"text-resource-text",
		]);
	});

	it("switches presets and resets phase-local answers", () => {
		const controller = createStreamingReproController({
			now: () => 1_500,
			hostMetrics: { width: 1280, height: 820 },
			theme: "dark",
		});

		controller.nextPhase();
		controller.recordAnswer("streaming_visible", {
			followState: "following",
			fallbackState: "healthy",
		});

		controller.setActivePreset("first-word-regression");

		expect(controller.activePreset.id).toBe("first-word-regression");
		expect(controller.activePhase.id).toBe("first-word");
		expect(controller.phaseIndex).toBe(0);
		expect(controller.answers).toEqual([]);
	});

	it("records a per-phase answer with reproducibility context", () => {
		const controller = createStreamingReproController({
			now: () => 2_000,
			hostMetrics: { width: 1360, height: 900 },
			theme: "dark",
		});

		controller.recordAnswer("streaming_visible", {
			followState: "following",
			fallbackState: "healthy",
		});

		expect(controller.answers).toEqual([
			{
				presetId: "core-streaming",
				phaseId: "thinking-only",
				phaseIndex: 0,
				answer: "streaming_visible",
				recordedAtMs: 2_000,
				hostWidthPx: 1360,
				hostHeightPx: 900,
				theme: "dark",
				followState: "following",
				fallbackState: "healthy",
				speedMs: controller.speedMs,
			},
		]);
	});

	it("advances deterministically and clears answers on reset", () => {
		const controller = createStreamingReproController({
			now: () => 3_000,
			hostMetrics: { width: 1200, height: 760 },
			theme: "light",
		});

		controller.nextPhase();
		controller.recordAnswer("streaming_not_visible", {
			followState: "detached",
			fallbackState: "healthy",
		});

		expect(controller.phaseIndex).toBe(1);
		expect(controller.answers).toHaveLength(1);

		controller.reset();

		expect(controller.phaseIndex).toBe(0);
		expect(controller.activePhase.id).toBe("thinking-only");
		expect(controller.answers).toEqual([]);
		expect(controller.isAutoplaying).toBe(false);
	});

	it("exports a durable run summary", () => {
		const controller = createStreamingReproController({
			now: () => 4_000,
			hostMetrics: { width: 1440, height: 880 },
			theme: "dark",
		});

		controller.recordAnswer("unclear", {
			followState: "following",
			fallbackState: "healthy",
		});

		const summary = controller.exportRunSummary();

		expect(summary).toEqual({
			presetId: "core-streaming",
			presetName: "Agent panel streaming",
			phaseIndex: 0,
			phaseId: "thinking-only",
			speedMs: controller.speedMs,
			host: { width: 1440, height: 880 },
			theme: "dark",
			answers: controller.answers,
		});
	});

	it("stops autoplay at the final phase", () => {
		vi.useFakeTimers();
		let nowMs = 5_000;
		const controller = createStreamingReproController({
			now: () => nowMs,
			hostMetrics: { width: 1280, height: 800 },
			theme: "dark",
		});

		controller.setSpeedMs(50);
		controller.play();

		for (let index = 0; index < 8; index += 1) {
			nowMs += 50;
			vi.advanceTimersByTime(50);
		}

		expect(controller.phaseIndex).toBe(controller.activePreset.phases.length - 1);
		expect(controller.isAutoplaying).toBe(false);

		vi.useRealTimers();
	});

	it.each([
		"streaming_visible",
		"streaming_not_visible",
		"unclear",
	] satisfies StreamingReproAnswer[])("accepts %s as a valid answer", (answer) => {
		const controller = createStreamingReproController({
			now: () => 6_000,
			hostMetrics: { width: 1280, height: 800 },
			theme: "dark",
		});

		controller.recordAnswer(answer, {
			followState: "following",
			fallbackState: "healthy",
		});

		expect(controller.answers[0]?.answer).toBe(answer);
	});
});

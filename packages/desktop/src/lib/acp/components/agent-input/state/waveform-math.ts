/**
 * Waveform math for Apple-like fluid audio visualization.
 *
 * Design goals:
 * - Configurable super-slim bars in a symmetric center-out layout
 * - Bars start at zero height (invisible at silence)
 * - Fast attack (sound appears instantly — zero perceived latency)
 * - Smooth decay (bars settle naturally, never snap down)
 * - Center bars respond most, edge bars spread outward with energy
 * - Organic, alive-feeling waveform like macOS Voice Memos
 */

export const DEFAULT_METER_BAR_COUNT = 25;
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 1;

/** Bars start at zero — no visible presence at silence */
export const RESTING_FILL = 0;

/** Attack: snap to target nearly instantly (zero perceived latency) */
const ATTACK = 0.9;
/** Decay: slower falloff for a smoother, more liquid motion */
const DECAY = 0.18;

export function smooth(prev: number, raw: number): number {
	const alpha = raw > prev ? ATTACK : DECAY;
	return prev + alpha * (raw - prev);
}

export function clampLevel(level: number): number {
	if (level < MIN_LEVEL) {
		return MIN_LEVEL;
	}
	if (level > MAX_LEVEL) {
		return MAX_LEVEL;
	}
	return level;
}

export function batchPeak(values: [number, number, number]): number {
	return Math.max(values[0], values[1], values[2]);
}

/**
 * Convert raw amplitude batch to a 0-1 meter level.
 * Speech RMS is typically 0.01-0.15 — we use a sqrt curve to
 * compress the dynamic range so quiet speech still moves bars visibly.
 */
export function toMeterLevel(values: [number, number, number]): number {
	const peak = batchPeak(values);
	return clampLevel(Math.sqrt(peak * 10));
}

/**
 * Build symmetric center-out meter levels for a configurable bar count.
 *
 * The center bars respond most. Bars further from center need
 * progressively more energy to activate, creating an organic spreading
 * waveform shape. At silence all bars are 0 (invisible).
 */
export function buildMeterLevels(level: number, barCount: number = DEFAULT_METER_BAR_COUNT): number[] {
	const clamped = clampLevel(level);
	const safeBarCount = barCount < 1 ? 1 : Math.floor(barCount);
	const center = Math.floor(safeBarCount / 2);
	const maxDistance = center > 0 ? center : 1;

	return Array.from({ length: safeBarCount }, (_, index) => {
		const dist = Math.abs(index - center);
		const normalizedDist = dist / maxDistance;
		const weight = 1 - normalizedDist * 0.45;
		const shaped = clamped * weight;
		return Math.min(Math.sqrt(shaped) * 0.85 + shaped * 0.15, 1);
	});
}

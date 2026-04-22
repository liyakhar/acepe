import { writable } from "svelte/store";

export const shaderKinds = [
	"grainGradient",
	"staticMeshGradient",
	"meshGradient",
	"warp",
	"waves",
	"colorPanels",
	"neuroNoise",
	"perlinNoise",
	"smokeRing",
	"spiral",
] as const;

export type ShaderKind = (typeof shaderKinds)[number];

export const DEFAULT_SHADER_KIND: ShaderKind = "grainGradient";

export type ShaderPalette = {
	background: string;
	colors: [string, string, string, string];
};

export const DEFAULT_DARK_PALETTE: ShaderPalette = {
	background: "#0F0F10",
	colors: ["#F77E2C", "#C85A12", "#5B2404", "#18120E"],
};

export const DEFAULT_LIGHT_PALETTE: ShaderPalette = {
	background: "#F0EEE6",
	colors: ["#F77E2C", "#F9A15E", "#FFD7A8", "#FFE7CA"],
};

export const DEFAULT_SPEED = 0.35;

export type ShaderParamValues = Record<string, number>;
export type ShaderParamOverrides = Partial<Record<ShaderKind, ShaderParamValues>>;

const STORAGE_KEY = "acepe-dev-shader-prefs-v2";

export type ShaderPrefs = {
	kind: ShaderKind;
	speed: number;
	paletteOverride: ShaderPalette | null;
	params: ShaderParamOverrides;
};

function defaultPrefs(): ShaderPrefs {
	return {
		kind: DEFAULT_SHADER_KIND,
		speed: DEFAULT_SPEED,
		paletteOverride: null,
		params: {},
	};
}

function isShaderKind(value: unknown): value is ShaderKind {
	return typeof value === "string" && (shaderKinds as readonly string[]).includes(value);
}

function parseStored(raw: string | null): ShaderPrefs {
	if (!raw) return defaultPrefs();
	const base = defaultPrefs();
	const parsed = safeJsonParse(raw);
	if (!parsed || typeof parsed !== "object") return base;
	const obj = parsed as Record<string, unknown>;
	if (isShaderKind(obj.kind)) base.kind = obj.kind;
	if (typeof obj.speed === "number" && Number.isFinite(obj.speed)) base.speed = obj.speed;
	if (obj.paletteOverride && typeof obj.paletteOverride === "object") {
		const p = obj.paletteOverride as Record<string, unknown>;
		if (
			typeof p.background === "string" &&
			Array.isArray(p.colors) &&
			p.colors.length === 4 &&
			p.colors.every((c) => typeof c === "string")
		) {
			base.paletteOverride = {
				background: p.background,
				colors: [p.colors[0], p.colors[1], p.colors[2], p.colors[3]] as [
					string,
					string,
					string,
					string,
				],
			};
		}
	}
	if (obj.params && typeof obj.params === "object") {
		const next: ShaderParamOverrides = {};
		for (const [k, v] of Object.entries(obj.params)) {
			if (isShaderKind(k) && v && typeof v === "object") {
				const values: ShaderParamValues = {};
				for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
					if (typeof pv === "number" && Number.isFinite(pv)) values[pk] = pv;
				}
				next[k] = values;
			}
		}
		base.params = next;
	}
	return base;
}

function safeJsonParse(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function readInitial(): ShaderPrefs {
	if (typeof window === "undefined") return defaultPrefs();
	return parseStored(window.localStorage.getItem(STORAGE_KEY));
}

export const shaderPrefsStore = writable<ShaderPrefs>(readInitial());

if (typeof window !== "undefined") {
	shaderPrefsStore.subscribe((value) => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	});
}

function clonePrefs(prev: ShaderPrefs): ShaderPrefs {
	const params: ShaderParamOverrides = {};
	for (const k of shaderKinds) {
		const v = prev.params[k];
		if (v) {
			const copy: ShaderParamValues = {};
			for (const [pk, pv] of Object.entries(v)) copy[pk] = pv;
			params[k] = copy;
		}
	}
	const paletteOverride: ShaderPalette | null = prev.paletteOverride
		? {
				background: prev.paletteOverride.background,
				colors: [
					prev.paletteOverride.colors[0],
					prev.paletteOverride.colors[1],
					prev.paletteOverride.colors[2],
					prev.paletteOverride.colors[3],
				],
			}
		: null;
	return { kind: prev.kind, speed: prev.speed, paletteOverride, params };
}

export function setShaderKind(kind: ShaderKind): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		next.kind = kind;
		return next;
	});
}

export function setShaderSpeed(speed: number): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		next.speed = speed;
		return next;
	});
}

export function setPaletteColor(index: 0 | 1 | 2 | 3, hex: string): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		const base = next.paletteOverride ?? {
			background: DEFAULT_DARK_PALETTE.background,
			colors: [
				DEFAULT_DARK_PALETTE.colors[0],
				DEFAULT_DARK_PALETTE.colors[1],
				DEFAULT_DARK_PALETTE.colors[2],
				DEFAULT_DARK_PALETTE.colors[3],
			],
		};
		base.colors[index] = hex;
		next.paletteOverride = base;
		return next;
	});
}

export function setPaletteBackground(hex: string): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		const base = next.paletteOverride ?? {
			background: DEFAULT_DARK_PALETTE.background,
			colors: [
				DEFAULT_DARK_PALETTE.colors[0],
				DEFAULT_DARK_PALETTE.colors[1],
				DEFAULT_DARK_PALETTE.colors[2],
				DEFAULT_DARK_PALETTE.colors[3],
			],
		};
		base.background = hex;
		next.paletteOverride = base;
		return next;
	});
}

export function clearPaletteOverride(): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		next.paletteOverride = null;
		return next;
	});
}

export function setShaderParam(kind: ShaderKind, id: string, value: number): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		const map = next.params[kind] ?? {};
		map[id] = value;
		next.params[kind] = map;
		return next;
	});
}

export function clearShaderParams(kind: ShaderKind): void {
	shaderPrefsStore.update((prev) => {
		const next = clonePrefs(prev);
		delete next.params[kind];
		return next;
	});
}

export function resetAllShaderPrefs(): void {
	shaderPrefsStore.set(defaultPrefs());
}

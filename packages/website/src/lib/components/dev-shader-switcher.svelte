<script lang="ts">
import { dev } from "$app/environment";
import {
	DEFAULT_DARK_PALETTE,
	clearPaletteOverride,
	clearShaderParams,
	resetAllShaderPrefs,
	setPaletteBackground,
	setPaletteColor,
	setShaderKind,
	setShaderParam,
	setShaderSpeed,
	shaderKinds,
	shaderPrefsStore,
	type ShaderKind,
} from "$lib/dev/shader-preference-store.js";
import { SHADER_DEFINITIONS } from "$lib/dev/shader-options.js";

let open = $state(false);

const prefs = $derived($shaderPrefsStore);
const currentKind = $derived(prefs.kind);
const def = $derived(SHADER_DEFINITIONS[currentKind]);
const values = $derived(prefs.params[currentKind] ?? {});
const palette = $derived(
	prefs.paletteOverride ?? {
		background: DEFAULT_DARK_PALETTE.background,
		colors: [
			DEFAULT_DARK_PALETTE.colors[0],
			DEFAULT_DARK_PALETTE.colors[1],
			DEFAULT_DARK_PALETTE.colors[2],
			DEFAULT_DARK_PALETTE.colors[3],
		],
	}
);

function getParamValue(id: string, fallback: number): number {
	const v = values[id];
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function onKindChange(event: Event) {
	const target = event.currentTarget as HTMLSelectElement;
	setShaderKind(target.value as ShaderKind);
}

function onSpeedInput(event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	setShaderSpeed(Number(target.value));
}

function onColorInput(index: 0 | 1 | 2 | 3, event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	setPaletteColor(index, target.value);
}

function onBackgroundInput(event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	setPaletteBackground(target.value);
}

function onNumberInput(id: string, event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	setShaderParam(currentKind, id, Number(target.value));
}

function onEnumChange(id: string, event: Event) {
	const target = event.currentTarget as HTMLSelectElement;
	setShaderParam(currentKind, id, Number(target.value));
}

function onBoolChange(id: string, event: Event) {
	const target = event.currentTarget as HTMLInputElement;
	setShaderParam(currentKind, id, target.checked ? 1 : 0);
}
</script>

{#if dev}
	<div class="shader-switcher" class:open>
		<button
			type="button"
			class="toggle"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-label="Dev: shader controls"
		>
			<span class="dot" aria-hidden="true"></span>
			<span class="label">Shader</span>
			<span class="current">{def.label}</span>
			<span class="chev" aria-hidden="true">{open ? "▾" : "▴"}</span>
		</button>

		{#if open}
			<div class="panel" role="dialog" aria-label="Shader controls">
				<div class="section">
					<div class="section-title">Shader</div>
					<label class="row">
						<span class="row-label">Type</span>
						<select class="select" value={currentKind} onchange={onKindChange}>
							{#each shaderKinds as kind (kind)}
								<option value={kind}>{SHADER_DEFINITIONS[kind].label}</option>
							{/each}
						</select>
					</label>
					<label class="row">
						<span class="row-label">Speed</span>
						<input
							type="range"
							min="0"
							max="2"
							step="0.01"
							value={prefs.speed}
							oninput={onSpeedInput}
							disabled={!def.animated}
						/>
						<span class="row-value">{prefs.speed.toFixed(2)}</span>
					</label>
				</div>

				<div class="section">
					<div class="section-title">
						<span>Palette</span>
						{#if prefs.paletteOverride}
							<button type="button" class="mini" onclick={clearPaletteOverride}
								>Reset to theme</button
							>
						{/if}
					</div>
					{#if def.usesBackground}
						<label class="row">
							<span class="row-label">Background</span>
							<input
								type="color"
								value={palette.background}
								oninput={onBackgroundInput}
							/>
							<span class="row-value swatch-hex">{palette.background}</span>
						</label>
					{/if}
					{#if def.colorCount >= 1}
						<div class="color-grid">
							{#each Array.from({ length: def.colorCount }, (_, i) => i) as i (i)}
								<label class="swatch">
									<input
										type="color"
										value={palette.colors[i]}
										oninput={(event) => onColorInput(i as 0 | 1 | 2 | 3, event)}
									/>
									<span class="swatch-hex">{palette.colors[i]}</span>
								</label>
							{/each}
						</div>
					{:else}
						<div class="hint">This shader ignores palette colors.</div>
					{/if}
				</div>

				{#if def.params.length > 0}
					<div class="section">
						<div class="section-title">
							<span>{def.label} params</span>
							{#if prefs.params[currentKind]}
								<button
									type="button"
									class="mini"
									onclick={() => clearShaderParams(currentKind)}>Reset</button
								>
							{/if}
						</div>
						{#each def.params as p (p.id)}
							{#if p.kind === "number"}
								<label class="row">
									<span class="row-label">{p.label}</span>
									<input
										type="range"
										min={p.min}
										max={p.max}
										step={p.step}
										value={getParamValue(p.id, p.default)}
										oninput={(event) => onNumberInput(p.id, event)}
									/>
									<span class="row-value"
										>{getParamValue(p.id, p.default).toFixed(
											p.step >= 1 ? 0 : 2
										)}</span
									>
								</label>
							{:else if p.kind === "enum"}
								<label class="row">
									<span class="row-label">{p.label}</span>
									<select
										class="select"
										value={getParamValue(p.id, p.default)}
										onchange={(event) => onEnumChange(p.id, event)}
									>
										{#each p.options as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</label>
							{:else}
								<label class="row">
									<span class="row-label">{p.label}</span>
									<input
										type="checkbox"
										checked={getParamValue(p.id, p.default) > 0.5}
										onchange={(event) => onBoolChange(p.id, event)}
									/>
								</label>
							{/if}
						{/each}
					</div>
				{/if}

				<div class="footer">
					<button type="button" class="mini danger" onclick={resetAllShaderPrefs}
						>Reset all</button
					>
					<span class="footer-hint">Saved to localStorage · dev only</span>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.shader-switcher {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 9999;
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 12px;
		color: #eaeaea;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(15, 15, 16, 0.82);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		color: #f2f2f2;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
		cursor: pointer;
		transition:
			transform 120ms ease,
			border-color 120ms ease;
	}

	.toggle:hover {
		border-color: rgba(247, 126, 44, 0.6);
		transform: translateY(-1px);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: linear-gradient(135deg, #f77e2c, #ffb27a);
		box-shadow: 0 0 10px rgba(247, 126, 44, 0.8);
	}

	.label {
		font-weight: 600;
		letter-spacing: 0.02em;
		opacity: 0.9;
	}

	.current {
		opacity: 0.7;
	}

	.chev {
		opacity: 0.5;
		font-size: 10px;
	}

	.panel {
		position: absolute;
		right: 0;
		bottom: calc(100% + 8px);
		width: 320px;
		max-height: min(72vh, 640px);
		overflow-y: auto;
		padding: 10px;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(15, 15, 16, 0.94);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.section-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.6;
		margin-bottom: 4px;
	}

	.row {
		display: grid;
		grid-template-columns: 88px 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
	}

	.row-label {
		opacity: 0.8;
		font-size: 11px;
	}

	.row-value {
		opacity: 0.65;
		font-variant-numeric: tabular-nums;
		font-size: 11px;
		min-width: 38px;
		text-align: right;
	}

	input[type="range"] {
		width: 100%;
		accent-color: #f77e2c;
	}

	.select {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: inherit;
		border-radius: 6px;
		padding: 4px 6px;
		font-size: 11px;
		width: 100%;
	}

	input[type="color"] {
		width: 32px;
		height: 24px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 6px;
		background: transparent;
		padding: 0;
		cursor: pointer;
	}

	.color-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.swatch {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		cursor: pointer;
	}

	.swatch-hex {
		font-size: 9px;
		opacity: 0.6;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.mini {
		font-size: 10px;
		padding: 3px 8px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: inherit;
		cursor: pointer;
	}

	.mini:hover {
		background: rgba(247, 126, 44, 0.18);
		border-color: rgba(247, 126, 44, 0.45);
	}

	.mini.danger:hover {
		background: rgba(255, 80, 80, 0.18);
		border-color: rgba(255, 80, 80, 0.5);
	}

	.hint {
		font-size: 10px;
		opacity: 0.5;
		padding: 4px 0;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 2px 2px;
	}

	.footer-hint {
		font-size: 10px;
		opacity: 0.45;
	}
</style>

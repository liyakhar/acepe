<script lang="ts">
import {
	GrainGradientShapes,
	type GrainGradientUniforms,
	getShaderColorFromString,
	getShaderNoiseTexture,
	grainGradientFragmentShader,
	ShaderFitOptions,
	ShaderMount,
} from "@paper-design/shaders";
import { onDestroy, onMount } from "svelte";

import { cn } from "../../lib/utils";
import { BRAND_SHADER_DARK_PALETTE } from "../../lib/brand-shader-palette.js";

type BrandShaderFallback = "solid" | "gradient";

interface Props {
	class?: string;
	fallback?: BrandShaderFallback;
}

let {
	class: className,
	fallback = "solid",
}: Props = $props();

let container: HTMLDivElement | null = $state(null);
let shaderReady = $state(false);
let shaderInitVersion = 0;
let shaderMountRef: ShaderMount | null = null;

const backgroundStyle = $derived(`background: ${BRAND_SHADER_DARK_PALETTE.background};`);
const fallbackStyle = $derived.by(() => {
	if (fallback === "gradient") {
		return `background: linear-gradient(135deg, ${BRAND_SHADER_DARK_PALETTE.colors[0]}, ${BRAND_SHADER_DARK_PALETTE.background});`;
	}

	return `background: ${BRAND_SHADER_DARK_PALETTE.background};`;
});

onMount(() => {
	if (!container) {
		return;
	}

	const initVersion = shaderInitVersion + 1;
	shaderInitVersion = initVersion;
	shaderReady = false;
	void initShader(container, initVersion).catch((error: Error) => {
		if (initVersion !== shaderInitVersion) {
			return;
		}

		console.error("[BrandShaderBackground] Failed to initialize shader:", error);
	});
});

onDestroy(() => {
	shaderInitVersion += 1;
	shaderMountRef?.dispose();
	shaderMountRef = null;
});

async function initShader(node: HTMLDivElement, initVersion: number) {
	const noiseTexture = getShaderNoiseTexture();

	if (noiseTexture && !noiseTexture.complete) {
		await new Promise<void>((resolve, reject) => {
			noiseTexture.onload = () => resolve();
			noiseTexture.onerror = () => reject(new Error("Failed to load shader noise texture"));
		});
	}

	if (initVersion !== shaderInitVersion) {
		return;
	}

	shaderMountRef = new ShaderMount(
		node,
		grainGradientFragmentShader,
		{
			u_colorBack: getShaderColorFromString(BRAND_SHADER_DARK_PALETTE.background),
			u_colors: [
				getShaderColorFromString(BRAND_SHADER_DARK_PALETTE.colors[0]),
				getShaderColorFromString(BRAND_SHADER_DARK_PALETTE.colors[1]),
				getShaderColorFromString(BRAND_SHADER_DARK_PALETTE.colors[2]),
				getShaderColorFromString(BRAND_SHADER_DARK_PALETTE.colors[3]),
			],
			u_colorsCount: 4,
			u_softness: BRAND_SHADER_DARK_PALETTE.softness,
			u_intensity: BRAND_SHADER_DARK_PALETTE.intensity,
			u_noise: BRAND_SHADER_DARK_PALETTE.noise,
			u_shape: GrainGradientShapes.corners,
			u_noiseTexture: noiseTexture,
			u_fit: ShaderFitOptions.cover,
			u_scale: 1,
			u_rotation: 0,
			u_originX: 0.5,
			u_originY: 0.5,
			u_offsetX: 0,
			u_offsetY: 0,
			u_worldWidth: node.offsetWidth,
			u_worldHeight: node.offsetHeight,
		} satisfies Partial<GrainGradientUniforms>,
		{ alpha: false, premultipliedAlpha: false },
		0.5
	);

	if (initVersion !== shaderInitVersion) {
		shaderMountRef.dispose();
		shaderMountRef = null;
		return;
	}

	shaderReady = true;
}
</script>

<div class={cn("absolute inset-0 overflow-hidden", className)} style={backgroundStyle}>
	<div
		bind:this={container}
		class={cn(
			"absolute inset-0 block h-full w-full transition-opacity duration-1000",
			shaderReady ? "opacity-100" : "opacity-0"
		)}
	></div>

	{#if !shaderReady}
		<div class="absolute inset-0" style={fallbackStyle}></div>
	{/if}
</div>

<style>
	div :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>

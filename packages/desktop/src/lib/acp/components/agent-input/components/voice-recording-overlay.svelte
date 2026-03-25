<!-- VoiceRecordingOverlay - Error-only content shown in the text area.
     Minimal Apple-like error display with subtle fade-in. -->
<script lang="ts">
import * as m from "$lib/paraglide/messages.js";
import type { VoiceInputState } from "../state/voice-input-state.svelte.js";

interface Props {
	voiceState: VoiceInputState;
}

const { voiceState }: Props = $props();

const isError = $derived(voiceState.phase === "error");
</script>

<div class="voice-overlay flex flex-col items-center justify-center gap-3 min-h-[72px] py-4">
	{#if isError}
		<div
			class="voice-error-card flex max-w-[280px] flex-col items-center gap-1.5 text-center"
			role="alert"
			aria-live="assertive"
		>
			<p class="text-[13px] text-muted-foreground leading-snug">
				{voiceState.errorMessage ? voiceState.errorMessage : m.voice_error_permission_denied()}
			</p>
		</div>
	{/if}
</div>

<style>
	.voice-overlay {
		animation: voice-fade-in 200ms ease-out;
	}

	.voice-error-card {
		animation: voice-error-appear 250ms ease-out;
	}

	@keyframes voice-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes voice-error-appear {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

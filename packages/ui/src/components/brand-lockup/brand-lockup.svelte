<script lang="ts">
	import logo from "../../../../../assets/logo.svg?url";
	import { cn } from "../../lib/utils.js";

	interface Props {
		class?: string;
		markClass?: string;
		wordmarkClass?: string;
	}

	let { class: className = "", markClass = "h-6 w-6", wordmarkClass = "" }: Props = $props();
</script>

<div class={cn("inline-flex items-center gap-2.5", className)}>
	<img
		src={logo}
		alt=""
		aria-hidden="true"
		class={cn("shrink-0 rounded-[22%] object-contain", markClass)}
	/>
	<span
		class={cn(
			"text-sm font-semibold leading-none tracking-[0.18em] text-foreground uppercase",
			wordmarkClass
		)}
	>
		ACEPE
	</span>
</div>

<script lang="ts">
	import { cn } from "../../lib/utils";
	import DotmTriangle20Spinner from "./dotm-triangle-20-spinner.svelte";

	interface Props {
		class?: string;
		role?: string;
		"aria-label"?: string;
		style?: string;
	}

	let { class: className = "", role, "aria-label": ariaLabel, style = "" }: Props = $props();
</script>

<DotmTriangle20Spinner
	class={cn("shrink-0", className)}
	{style}
	color="#bf8700"
	role={role ?? "status"}
	aria-label={ariaLabel ?? "Loading"}
/>

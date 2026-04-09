<script lang="ts">
import { ProviderMark } from "@acepe/ui";

interface Props {
	providerId: string;
	class?: string;
}

let { providerId, class: className }: Props = $props();
</script>

<ProviderMark provider={providerId} class={className} />

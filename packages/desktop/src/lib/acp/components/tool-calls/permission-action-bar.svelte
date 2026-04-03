<script lang="ts">
import { FilePathBadge } from "@acepe/ui";
import { Button } from "@acepe/ui/button";
import CheckCircle from "phosphor-svelte/lib/CheckCircle";
import ShieldCheck from "phosphor-svelte/lib/ShieldCheck";
import ShieldWarning from "phosphor-svelte/lib/ShieldWarning";
import XCircle from "phosphor-svelte/lib/XCircle";
import * as m from "$lib/paraglide/messages.js";
import { getPermissionStore } from "../../store/permission-store.svelte.js";
import type { PermissionRequest } from "../../types/permission.js";
import { COLOR_NAMES, Colors } from "../../utils/colors.js";
import { extractCompactPermissionDisplay } from "./permission-display.js";

interface Props {
	permission: PermissionRequest;
	compact?: boolean;
	projectPath?: string | null;
}

let { permission, compact = false, projectPath = null }: Props = $props();

const permissionStore = getPermissionStore();

const hasAlwaysOption = $derived(permission.always && permission.always.length > 0);
const compactDisplay = $derived(extractCompactPermissionDisplay(permission, projectPath));

function handleReject() {
	permissionStore.reply(permission.id, "reject");
}

function handleAllowOnce() {
	permissionStore.reply(permission.id, "once");
}

function handleAlwaysAllow() {
	permissionStore.reply(permission.id, "always");
}

const greenColor = "var(--success)";
const redColor = Colors[COLOR_NAMES.RED];
const purpleColor = Colors[COLOR_NAMES.PURPLE];
const buttonClass = $derived(compact ? "size-6 justify-center px-0" : "flex-1 justify-center");
</script>

<div class="flex w-full min-w-0 flex-col gap-1">
	{#if compact}
		<div class="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
			<ShieldWarning weight="fill" class="size-3 shrink-0" style="color: {purpleColor}" />
			<span class="shrink-0 font-medium text-muted-foreground">{compactDisplay.label}</span>
			{#if compactDisplay.filePath}
				<div class="min-w-0 flex-1">
					<FilePathBadge filePath={compactDisplay.filePath} interactive={false} size="sm" />
				</div>
			{:else if compactDisplay.command}
				<code class="min-w-0 flex-1 truncate font-mono text-foreground/70">$ {compactDisplay.command}</code>
			{/if}
		</div>
	{/if}

	<div class="flex w-full items-center gap-1">
		<Button variant="toolbar" size="toolbar" class={buttonClass} onclick={handleReject}>
			<XCircle weight="fill" class="size-3 shrink-0" style="color: {redColor}" />
			{#if !compact}<span>{m.permission_deny()}</span>{/if}
		</Button>

		<Button variant="toolbar" size="toolbar" class={buttonClass} onclick={handleAllowOnce}>
			<CheckCircle weight="fill" class="size-3 shrink-0" style="color: {greenColor}" />
			{#if !compact}<span>{m.permission_allow()}</span>{/if}
		</Button>

		{#if hasAlwaysOption}
			<Button variant="toolbar" size="toolbar" class={buttonClass} onclick={handleAlwaysAllow}>
				<ShieldCheck weight="fill" class="size-3 shrink-0" style="color: {purpleColor}" />
				{#if !compact}<span>{m.permission_always_allow()}</span>{/if}
			</Button>
		{/if}
	</div>
</div>

<script lang="ts">
	import { FilePathBadge, ToolTally } from "@acepe/ui";
	import ShieldWarning from "phosphor-svelte/lib/ShieldWarning";
	import { getPermissionStore } from "../../store/permission-store.svelte.js";
	import { getSessionStore } from "../../store/session-store.svelte.js";
	import type { PermissionRequest } from "../../types/permission.js";
	import { makeWorkspaceRelative } from "../../utils/path-utils.js";
	import { shouldHidePermissionBarForExitPlan } from "./exit-plan-helpers.js";
	import PermissionActionBar from "./permission-action-bar.svelte";
	import { extractPermissionCommand, extractPermissionFilePath } from "./permission-display.js";

 	interface Props {
		sessionId: string;
		isFullscreen?: boolean;
		projectPath?: string | null;
	}

	let { sessionId, isFullscreen = false, projectPath = null }: Props = $props();

	const permissionStore = getPermissionStore();
	const sessionStore = getSessionStore();

	const pendingPermissions = $derived.by(() => {
		const entries = sessionStore.getEntries(sessionId);
		const visiblePermissions: PermissionRequest[] = [];

		for (const permission of permissionStore.getForSession(sessionId)) {
			if (shouldHidePermissionBarForExitPlan(permission, entries)) {
				continue;
			}

			visiblePermissions.push(permission);
		}

		return visiblePermissions;
	});
	const currentPermission = $derived(pendingPermissions.length > 0 ? pendingPermissions[0] : null);
	const sessionProgress = $derived(permissionStore.getSessionProgress(sessionId));
	const progressLabel = $derived.by(() => {
		if (!sessionProgress) {
			return "";
		}

		const currentStep =
			sessionProgress.completed + 1 <= sessionProgress.total
				? sessionProgress.completed + 1
				: sessionProgress.total;
		return `Permission ${currentStep} of ${sessionProgress.total}`;
	});

	function extractCommand(permission: PermissionRequest): string | null {
		return extractPermissionCommand(permission);
	}

	function extractFilePath(permission: PermissionRequest): string | null {
		const path = extractPermissionFilePath(permission);
		if (!path) return null;
		const basePath = projectPath ? projectPath : "";
		return makeWorkspaceRelative(path, basePath);
	}

	function extractVerb(
		permission: PermissionRequest,
		filePath: string | null,
		command: string | null
	): string {
		if (filePath || command) {
			const firstWord = permission.permission.split(" ")[0];
			return firstWord ? firstWord : permission.permission;
		}
		return permission.permission;
	}
</script>


{#if currentPermission}
	{@const command = extractCommand(currentPermission)}
	{@const filePath = extractFilePath(currentPermission)}
	{@const verb = extractVerb(currentPermission, filePath, command)}
	<div class="w-full px-5 mb-1">
		<div class="permission-card">
			<!-- Header: fixed h-7 embedded row -->
			<div class="flex h-7 items-center justify-between gap-2 border-b border-border/50 px-2.5">
				<div class="flex min-w-0 flex-1 items-center gap-1.5">
					<ShieldWarning weight="fill" class="size-3 text-primary shrink-0" />
					<span class="text-xs font-medium text-muted-foreground shrink-0">{verb}</span>
					{#if filePath}
						<div class="min-w-0 flex-1">
							<FilePathBadge {filePath} iconBasePath="/svgs/icons" interactive={false} />
						</div>
					{/if}
				</div>
				{#if sessionProgress}
					<div class="shrink-0">
						<ToolTally
							mode="progress"
							totalCount={sessionProgress.total}
							filledCount={sessionProgress.completed}
							ariaLabel={progressLabel}
							inline={true}
						/>
					</div>
				{/if}
			</div>

			<!-- Content: height-limited command display -->
			{#if command}
				<div class="max-h-[72px] overflow-y-auto border-b border-border/50 px-2.5 py-1.5">
					<code class="block min-w-0 whitespace-pre-wrap break-all font-mono text-xs text-foreground/80"
						>$ {command}</code
					>
				</div>
			{/if}

			<!-- Footer: action buttons right-aligned -->
			<div class="flex items-center justify-end px-2.5 py-1.5">
				<PermissionActionBar permission={currentPermission} />
			</div>
		</div>
	</div>
{/if}

<style>
	.permission-card {
		overflow: hidden;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--accent) 50%, var(--card) 50%);
		animation: slideUp 0.2s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

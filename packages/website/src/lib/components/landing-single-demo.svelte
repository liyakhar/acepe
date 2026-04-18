<script lang="ts">
	import { SingleAgentEmptyState } from "@acepe/ui/single-agent-empty-state";
	import type {
		SingleAgentEmptyStateAgentSelectorModel,
		SingleAgentEmptyStateProjectSelectorModel,
		SingleAgentEmptyStateBranchPickerModel,
		SingleAgentEmptyStateAgentInputModel,
	} from "@acepe/ui/single-agent-empty-state";

	import LandingDemoFrame from "./landing-demo-frame.svelte";
	import { websiteThemeStore } from "$lib/theme/theme.js";

	const theme = $derived($websiteThemeStore);

	function agentIcon(agent: "claude" | "codex" | "cursor" | "opencode", t: string): string {
		if (agent === "codex") return `/svgs/agents/codex/codex-icon-${t}.svg`;
		if (agent === "cursor") return `/svgs/agents/cursor/cursor-icon-${t}.svg`;
		if (agent === "opencode") return `/svgs/agents/opencode/opencode-logo-${t}.svg`;
		return `/svgs/agents/claude/claude-icon-${t}.svg`;
	}

	const agentSelectorModel = $derived<SingleAgentEmptyStateAgentSelectorModel>({
		agents: [
			{ id: "claude-code", name: "Claude Code", iconSrc: agentIcon("claude", theme), isFavorite: true },
			{ id: "codex", name: "Codex", iconSrc: agentIcon("codex", theme), isFavorite: true },
			{ id: "cursor", name: "Cursor", iconSrc: agentIcon("cursor", theme), isFavorite: false },
			{ id: "opencode", name: "OpenCode", iconSrc: agentIcon("opencode", theme), isFavorite: false },
		],
		selectedAgentId: "claude-code",
	});

	const projectSelectorModel: SingleAgentEmptyStateProjectSelectorModel = {
		selectedProject: {
			path: "/Users/dev/acepe",
			name: "acepe.dev",
			color: "#9858FF",
			iconSrc: null,
		},
		recentProjects: [
			{ path: "/Users/dev/acepe", name: "acepe.dev", color: "#9858FF", iconSrc: null },
			{ path: "/Users/dev/desktop", name: "desktop", color: "#4AD0FF", iconSrc: null },
			{ path: "/Users/dev/api", name: "api", color: "#FF8D20", iconSrc: null },
		],
	};

	const branchPickerModel: SingleAgentEmptyStateBranchPickerModel = {
		currentBranch: "feat/landing-showcase",
		diffStats: { insertions: 127, deletions: 34 },
		branches: ["main", "feat/landing-showcase", "fix/auth-middleware", "feat/kanban-scenes"],
		variant: "minimal",
	};

	const agentInputModel = $derived<SingleAgentEmptyStateAgentInputModel>({
		placeholder: "What do you want to build?",
		value: "",
		agentPills: [{ id: "claude-code", name: "Claude Code", iconSrc: agentIcon("claude", theme) }],
		showAttachButton: true,
		showVoiceButton: true,
		showExpandButton: false,
		isSending: false,
		disabled: false,
	});
</script>

<LandingDemoFrame>
	{#snippet children()}
		<SingleAgentEmptyState
			heading="What do you want to build?"
			showAgentSelector={true}
			showProjectSelector={true}
			showBranchPicker={true}
			agentSelector={agentSelectorModel}
			projectSelector={projectSelectorModel}
			branchPicker={branchPickerModel}
			agentInput={agentInputModel}
		/>
	{/snippet}
</LandingDemoFrame>

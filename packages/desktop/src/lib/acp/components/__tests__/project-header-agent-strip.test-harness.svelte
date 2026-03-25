<script lang="ts">
import type { AgentInfo } from "$lib/acp/logic/agent-manager.js";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";

import ProjectHeaderAgentStrip from "../project-header-agent-strip.svelte";

interface Props {
	projectPath: string;
	projectName: string;
	availableAgents: AgentInfo[];
	effectiveTheme: "light" | "dark";
	onCancel: (projectPath: string) => void;
	onCreateSession: (projectPath: string, agentId: string) => void;
	onOpenTerminal: (projectPath: string) => void;
	onOpenBrowser: (projectPath: string) => void;
}

let {
	projectPath,
	projectName,
	availableAgents,
	effectiveTheme,
	onCancel,
	onCreateSession,
	onOpenTerminal,
	onOpenBrowser,
}: Props = $props();
</script>

<Tooltip.Provider>
	<ProjectHeaderAgentStrip
		{projectPath}
		{projectName}
		{availableAgents}
		{effectiveTheme}
		{onCancel}
		{onCreateSession}
		{onOpenTerminal}
		{onOpenBrowser}
	/>
</Tooltip.Provider>

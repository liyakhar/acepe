export function getPreparingThreadLabel(agentName: string | null | undefined): string {
	const trimmedAgentName = agentName?.trim() ?? "";
	if (trimmedAgentName.length > 0) {
		return `Connecting to ${trimmedAgentName}...`;
	}

	return "Connecting to agent...";
}

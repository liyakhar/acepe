export interface AgentCardProps {
	agentId: string;
	agentName: string;
	iconSrc: string;
	isSelected?: boolean;
	onclick?: () => void;
}

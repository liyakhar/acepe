const renderCounts = new Map<string, number>();
const mountCounts = new Map<string, number>();
const destroyCounts = new Map<string, number>();

export function resetAgentPanelStubState(): void {
	renderCounts.clear();
	mountCounts.clear();
	destroyCounts.clear();
}

export function recordAgentPanelRender(panelId: string): void {
	renderCounts.set(panelId, (renderCounts.get(panelId) ?? 0) + 1);
}

export function recordAgentPanelMount(panelId: string): void {
	mountCounts.set(panelId, (mountCounts.get(panelId) ?? 0) + 1);
}

export function recordAgentPanelDestroy(panelId: string): void {
	destroyCounts.set(panelId, (destroyCounts.get(panelId) ?? 0) + 1);
}

export function getAgentPanelRenderCount(panelId: string): number {
	return renderCounts.get(panelId) ?? 0;
}

export function getAgentPanelMountCount(panelId: string): number {
	return mountCounts.get(panelId) ?? 0;
}

export function getAgentPanelDestroyCount(panelId: string): number {
	return destroyCounts.get(panelId) ?? 0;
}

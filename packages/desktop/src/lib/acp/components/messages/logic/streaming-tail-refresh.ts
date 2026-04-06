export const LIVE_REFRESH_CLASS = "streaming-live-refresh";

export interface StreamingTailRefreshParams {
	active: boolean;
	value: string;
}

function restartRefreshAnimation(node: HTMLElement) {
	node.classList.remove(LIVE_REFRESH_CLASS);
	void node.offsetWidth;
	node.classList.add(LIVE_REFRESH_CLASS);
}

export function streamingTailRefresh(node: HTMLElement, params: StreamingTailRefreshParams) {
	let isActive = params.active;
	let currentValue = params.value;

	if (isActive && currentValue.length > 0) {
		restartRefreshAnimation(node);
	}

	return {
		update(next: StreamingTailRefreshParams) {
			const valueChanged = next.value !== currentValue;
			currentValue = next.value;

			if (!next.active) {
				isActive = false;
				node.classList.remove(LIVE_REFRESH_CLASS);
				return;
			}

			if (!isActive || valueChanged) {
				restartRefreshAnimation(node);
			}

			isActive = true;
		},
		destroy() {
			node.classList.remove(LIVE_REFRESH_CLASS);
		},
	};
}

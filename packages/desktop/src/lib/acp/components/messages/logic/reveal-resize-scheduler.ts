export type RevealResizeScheduler = {
	request(): void;
	cancel(): void;
};

export function createRevealResizeScheduler(onReveal: () => void): RevealResizeScheduler {
	let frameId: number | null = null;

	function cancel(): void {
		if (frameId === null) {
			return;
		}
		cancelAnimationFrame(frameId);
		frameId = null;
	}

	function request(): void {
		if (frameId !== null) {
			return;
		}
		frameId = requestAnimationFrame(() => {
			frameId = null;
			onReveal();
		});
	}

	return {
		request,
		cancel,
	};
}

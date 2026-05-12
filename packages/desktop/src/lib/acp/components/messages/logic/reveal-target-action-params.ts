import type { ThreadFollowController } from "../../agent-panel/logic/thread-follow-controller.svelte.js";

export type RevealTargetActionParams = {
	controller: ThreadFollowController | undefined;
	entryIndex: number;
	entryKey: string;
	observeRevealResize: boolean;
	revealEntryIndex?: (index: number, force?: boolean) => boolean;
};

export function shouldRestartRevealTargetAction(
	currentParams: RevealTargetActionParams,
	nextParams: RevealTargetActionParams
): boolean {
	return (
		nextParams.controller !== currentParams.controller ||
		nextParams.entryKey !== currentParams.entryKey ||
		nextParams.observeRevealResize !== currentParams.observeRevealResize ||
		(nextParams.revealEntryIndex !== undefined) !==
			(currentParams.revealEntryIndex !== undefined)
	);
}

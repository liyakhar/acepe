export interface VoiceKeyboardEventLike {
	altKey: boolean;
	code: string;
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	repeat?: boolean;
	shiftKey: boolean;
}

function isBareSpace(event: VoiceKeyboardEventLike): boolean {
	const isSpaceKey = event.code === "Space" || event.key === " " || event.key === "Spacebar";
	if (!isSpaceKey) {
		return false;
	}

	return !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
}

export function shouldStartVoiceHold(event: VoiceKeyboardEventLike): boolean {
	if (!isBareSpace(event)) {
		return false;
	}

	return event.repeat !== true;
}

export function shouldStopVoiceHold(event: VoiceKeyboardEventLike, isPressAndHold: boolean): boolean {
	if (!isPressAndHold) {
		return false;
	}

	return isBareSpace(event);
}

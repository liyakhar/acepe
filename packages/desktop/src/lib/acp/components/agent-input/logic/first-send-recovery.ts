import { PanelConnectionState } from "../../../types/panel-connection-state.js";
import type { Attachment } from "../types/attachment.js";

export interface ComposerRestoreSnapshot {
	draft: string;
	attachments: Attachment[];
	inlineTextEntries: Array<[string, string]>;
}

export interface ComposerRestoreTarget {
	message: string;
	attachments: Attachment[];
	clearInlineTextMap(): void;
	updateInlineText(refId: string, text: string): void;
}

function cloneAttachment(attachment: Attachment): Attachment {
	const base: Attachment = {
		id: attachment.id,
		type: attachment.type,
		path: attachment.path,
		displayName: attachment.displayName,
		extension: attachment.extension,
	};
	if (attachment.content !== undefined) {
		return {
			id: base.id,
			type: base.type,
			path: base.path,
			displayName: base.displayName,
			extension: base.extension,
			content: attachment.content,
		};
	}
	return base;
}

export function restoreComposerStateAfterFailedSend(
	target: ComposerRestoreTarget,
	snapshot: ComposerRestoreSnapshot
): void {
	target.message = snapshot.draft;
	target.clearInlineTextMap();
	for (let i = 0; i < snapshot.inlineTextEntries.length; i += 1) {
		const entry = snapshot.inlineTextEntries[i];
		const refId = entry[0];
		const text = entry[1];
		target.updateInlineText(refId, text);
	}
	const cloned: Attachment[] = [];
	for (let i = 0; i < snapshot.attachments.length; i += 1) {
		cloned.push(cloneAttachment(snapshot.attachments[i]));
	}
	target.attachments = cloned;
}

export function formatPreSessionSendFailure(error: Error): string {
	const segments: string[] = [];
	let current: Error | undefined = error;
	while (current !== undefined) {
		segments.push(current.message);
		const cause: unknown = current.cause;
		if (cause instanceof Error) {
			current = cause;
		} else {
			break;
		}
	}
	return segments.join(" ");
}

export function shouldDisableSendForFailedFirstSend(params: {
	hasSession: boolean;
	panelConnectionState: PanelConnectionState;
}): boolean {
	if (params.hasSession) {
		return false;
	}
	return params.panelConnectionState === PanelConnectionState.ERROR;
}

import { isToolCallEntry, type SessionEntry } from "../../application/dto/session-entry.js";
import type { PermissionRequest } from "../../types/permission.js";

import { shouldHidePermissionBarForExitPlan } from "./exit-plan-helpers.js";

export function isPermissionRepresentedByToolCall(
	permission: PermissionRequest,
	entries: ReadonlyArray<SessionEntry>
): boolean {
	if (shouldHidePermissionBarForExitPlan(permission, entries)) {
		return true;
	}

	const toolReference = permission.tool;
	if (!toolReference) {
		return false;
	}

	for (const entry of entries) {
		if (!isToolCallEntry(entry)) {
			continue;
		}

		if (entry.message.id === toolReference.callID) {
			return true;
		}
	}

	return false;
}

export function visiblePermissionsForSessionBar(
	permissions: ReadonlyArray<PermissionRequest>,
	entries: ReadonlyArray<SessionEntry>
): PermissionRequest[] {
	return permissions.filter((permission) => !isPermissionRepresentedByToolCall(permission, entries));
}

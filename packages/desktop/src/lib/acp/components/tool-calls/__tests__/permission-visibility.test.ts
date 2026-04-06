import { describe, expect, it } from "bun:test";

import type { SessionEntry } from "../../../application/dto/session-entry.js";
import type { PermissionRequest } from "../../../types/permission.js";

import {
	isPermissionRepresentedByToolCall,
	visiblePermissionsForSessionBar,
} from "../permission-visibility.js";

function createPermission(toolCallId: string): PermissionRequest {
	return {
		id: `permission-${toolCallId}`,
		sessionId: "session-1",
		permission: "Execute",
		patterns: [],
		metadata: {},
		always: [],
		tool: {
			messageID: "",
			callID: toolCallId,
		},
	};
}

function createToolCallEntry(toolCallId: string, kind: "execute" | "edit" = "execute"): SessionEntry {
	return {
		id: `entry-${toolCallId}`,
		type: "tool_call",
		timestamp: new Date(),
		message: {
			id: toolCallId,
			name: kind === "edit" ? "Edit" : "Execute",
			arguments:
				kind === "edit"
					? {
							kind: "edit",
							edits: [{ filePath: "/repo/file.ts", oldString: null, newString: null, content: null }],
						}
					: {
							kind: "execute",
							command: "git status",
						},
			status: "in_progress",
			kind,
			title: null,
			locations: null,
			skillMeta: null,
			result: null,
			normalizedQuestions: null,
			normalizedTodos: null,
			parentToolUseId: null,
			taskChildren: null,
			questionAnswer: null,
			awaitingPlanApproval: false,
			planApprovalRequestId: null,
		},
		isStreaming: true,
	};
}

describe("permission visibility", () => {
	it("treats a permission with a matching tool-call entry as represented", () => {
		const permission = createPermission("tool-1");
		const entries = [createToolCallEntry("tool-1")];

		expect(isPermissionRepresentedByToolCall(permission, entries)).toBe(true);
	});

	it("keeps orphan permissions visible when no matching tool-call entry exists", () => {
		const permission = createPermission("tool-2");
		const entries = [createToolCallEntry("tool-1")];

		expect(isPermissionRepresentedByToolCall(permission, entries)).toBe(false);
		expect(visiblePermissionsForSessionBar([permission], entries)).toEqual([permission]);
	});

	it("keeps anchored permissions visible in the session-level permission bar", () => {
		const anchoredPermission = createPermission("tool-1");
		const orphanPermission = createPermission("tool-2");
		const entries = [createToolCallEntry("tool-1")];

		expect(
			visiblePermissionsForSessionBar([anchoredPermission, orphanPermission], entries)
		).toEqual([anchoredPermission, orphanPermission]);
	});
});

import type {
	JsonValue,
	SessionPlanResponse,
	ToolArguments,
} from "../../../services/converted-session-types.js";
import { isToolCallEntry, type SessionEntry } from "../../application/dto/session-entry.js";
import type { PermissionRequest } from "../../types/permission.js";
import type { ToolCall } from "../../types/tool-call.js";
import { parsePlanMarkdown } from "../../utils/plan-parser.js";

interface ExitPlanRawInput {
	plan: string | null;
	planFilePath: string | null;
	planPath: string | null;
	filePath: string | null;
	allowedPrompts: string[];
}

function isJsonObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
	return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}

	return trimmed;
}

function readStringField(record: Record<string, JsonValue>, key: string): string | null {
	const value = record[key];
	if (typeof value !== "string") {
		return null;
	}

	return normalizeString(value);
}

function readStringArrayField(record: Record<string, JsonValue>, key: string): string[] {
	const value = record[key];
	if (!Array.isArray(value)) {
		return [];
	}

	const items: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") {
			continue;
		}

		const normalized = normalizeString(entry);
		if (normalized !== null) {
			items.push(normalized);
		}
	}

	return items;
}

function hasExitPlanFields(input: ExitPlanRawInput): boolean {
	return (
		input.plan !== null ||
		input.planFilePath !== null ||
		input.planPath !== null ||
		input.filePath !== null ||
		input.allowedPrompts.length > 0
	);
}

export function readExitPlanRawInput(value: JsonValue | undefined): ExitPlanRawInput | null {
	if (!isJsonObject(value)) {
		return null;
	}

	const input: ExitPlanRawInput = {
		plan: readStringField(value, "plan"),
		planFilePath: readStringField(value, "planFilePath"),
		planPath: readStringField(value, "planPath"),
		filePath: readStringField(value, "filePath"),
		allowedPrompts: readStringArrayField(value, "allowedPrompts"),
	};

	return hasExitPlanFields(input) ? input : null;
}

function getToolRawInput(argumentsValue: ToolArguments): JsonValue | undefined {
	if (argumentsValue.kind !== "other") {
		return undefined;
	}

	return argumentsValue.raw;
}

export function readExitPlanToolInput(toolCall: ToolCall): ExitPlanRawInput | null {
	return readExitPlanRawInput(getToolRawInput(toolCall.arguments));
}

export function readExitPlanPermissionInput(permission: PermissionRequest): ExitPlanRawInput | null {
	return readExitPlanRawInput(permission.metadata.rawInput);
}

function getPreferredPlanFilePath(input: ExitPlanRawInput | null): string | null {
	if (input === null) {
		return null;
	}

	if (input.planFilePath !== null) {
		return input.planFilePath;
	}

	if (input.planPath !== null) {
		return input.planPath;
	}

	if (input.filePath !== null) {
		return input.filePath;
	}

	return null;
}

function extractSlug(filePath: string | null): string {
	if (filePath === null) {
		return "plan";
	}

	const segments = filePath.split("/");
	const fileName = segments.length > 0 ? segments[segments.length - 1] : filePath;
	if (fileName.endsWith(".md")) {
		return fileName.slice(0, -3);
	}

	return fileName;
}

function buildPlanFromInput(input: ExitPlanRawInput | null): SessionPlanResponse | null {
	if (input === null || input.plan === null) {
		return null;
	}

	const parsedPlan = parsePlanMarkdown(input.plan);
	const filePath = getPreferredPlanFilePath(input);
	const title = normalizeString(parsedPlan.title);

	return {
		slug: extractSlug(filePath),
		content: input.plan,
		title: title !== null ? title : "Plan",
		summary: parsedPlan.summary,
		filePath,
	};
}

function hasPlanContent(plan: SessionPlanResponse | null | undefined): plan is SessionPlanResponse {
	if (plan === null || plan === undefined) {
		return false;
	}

	return normalizeString(plan.content) !== null;
}

function isPlanPermissionLabel(permission: PermissionRequest): boolean {
	return permission.permission === "ExitPlanMode" || permission.permission === "Plan";
}

export function isExitPlanPermission(permission: PermissionRequest): boolean {
	const rawInput = readExitPlanPermissionInput(permission);
	const hasPlanPayload = hasExitPlanFields(
		rawInput !== null
			? rawInput
			: {
					plan: null,
					planFilePath: null,
					planPath: null,
					filePath: null,
					allowedPrompts: [],
				}
	);
	const parsedArguments = permission.metadata.parsedArguments;
	const looksLikePlanMode = parsedArguments !== null && parsedArguments !== undefined
		? parsedArguments.kind === "planMode"
		: false;

	if (isPlanPermissionLabel(permission) && hasPlanPayload) {
		return true;
	}

	return looksLikePlanMode && hasPlanPayload;
}

function permissionScore(toolCall: ToolCall, permission: PermissionRequest): number {
	if (!isExitPlanPermission(permission)) {
		return -1;
	}

	const toolReference = permission.tool;
	if (toolReference !== undefined && toolReference.callID === toolCall.id) {
		return 3;
	}

	const toolInput = readExitPlanToolInput(toolCall);
	const permissionInput = readExitPlanPermissionInput(permission);
	const toolFilePath = getPreferredPlanFilePath(toolInput);
	const permissionFilePath = getPreferredPlanFilePath(permissionInput);
	if (toolFilePath !== null && permissionFilePath !== null && toolFilePath === permissionFilePath) {
		return 2;
	}

	const toolPlan = toolInput !== null ? toolInput.plan : null;
	const permissionPlan = permissionInput !== null ? permissionInput.plan : null;
	if (toolPlan !== null && permissionPlan !== null && toolPlan === permissionPlan) {
		return 1;
	}

	return 0;
}

export function findExitPlanPermission(
	toolCall: ToolCall,
	permissions: ReadonlyArray<PermissionRequest>
): PermissionRequest | null {
	let bestPermission: PermissionRequest | null = null;
	let bestScore = -1;
	let bestRequestId = -1;

	for (const permission of permissions) {
		const score = permissionScore(toolCall, permission);
		if (score < 0) {
			continue;
		}

		const requestId = permission.jsonRpcRequestId !== undefined ? permission.jsonRpcRequestId : -1;
		const isBetterScore = score > bestScore;
		const isNewerAtSameScore = score === bestScore && requestId >= bestRequestId;
		if (isBetterScore || isNewerAtSameScore) {
			bestPermission = permission;
			bestScore = score;
			bestRequestId = requestId;
		}
	}

	return bestPermission;
}

export function getExitPlanDisplayPlan(
	toolCall: ToolCall,
	permission: PermissionRequest | null,
	sessionPlan: SessionPlanResponse | null | undefined
): SessionPlanResponse | null {
	if (hasPlanContent(sessionPlan)) {
		return sessionPlan;
	}

	const permissionPlan = buildPlanFromInput(
		permission !== null ? readExitPlanPermissionInput(permission) : null
	);
	if (permissionPlan !== null) {
		return permissionPlan;
	}

	return buildPlanFromInput(readExitPlanToolInput(toolCall));
}

export function shouldHidePermissionBarForExitPlan(
	permission: PermissionRequest,
	entries: ReadonlyArray<SessionEntry>
): boolean {
	if (!isExitPlanPermission(permission)) {
		return false;
	}

	const toolReference = permission.tool;
	if (toolReference !== undefined) {
		for (const entry of entries) {
			if (!isToolCallEntry(entry)) {
				continue;
			}

			if (entry.message.id === toolReference.callID && entry.message.kind === "exit_plan_mode") {
				return true;
			}
		}
	}

	for (const entry of entries) {
		if (!isToolCallEntry(entry)) {
			continue;
		}

		if (entry.message.kind === "exit_plan_mode") {
			return true;
		}
	}

	return false;
}
import type { SessionEntry } from "../../acp/application/dto/session-entry.js";
import { isToolCallEntry } from "../../acp/application/dto/session-entry.js";
import type { QuestionRequest } from "../../acp/types/question.js";
import type { ToolCallData } from "../../acp/types/tool-call.js";

const PLAN_APPROVAL_TOOL_KINDS = new Set(["create_plan", "exit_plan_mode"]);

function getQuestionToolCallId(question: QuestionRequest): string {
	return question.tool?.callID ?? question.id;
}

function getQuestionTitle(question: QuestionRequest): string {
	const firstQuestion = question.questions[0];
	return firstQuestion?.header || firstQuestion?.question || "Question";
}

export function getQuestionToolCallBackfill(
	question: QuestionRequest,
	entries: readonly SessionEntry[]
): ToolCallData | null {
	const toolCallId = getQuestionToolCallId(question);
	const existingEntry = entries.find(
		(entry): entry is Extract<SessionEntry, { type: "tool_call" }> =>
			isToolCallEntry(entry) && entry.message.id === toolCallId
	);

	if (
		existingEntry &&
		existingEntry.message.kind === "question" &&
		(existingEntry.message.normalizedQuestions?.length ?? 0) > 0
	) {
		return null;
	}

	const existingKind = existingEntry?.message.kind;

	if (existingKind && PLAN_APPROVAL_TOOL_KINDS.has(existingKind)) {
		return null;
	}

	return {
		id: toolCallId,
		name: existingEntry?.message.name ?? "AskUserQuestion",
		arguments: existingEntry?.message.arguments ?? {
			kind: "other",
			raw: {
				questions: question.questions,
			},
		},
		status: existingEntry?.message.status ?? "pending",
		kind: "question",
		title: existingEntry?.message.title ?? getQuestionTitle(question),
		normalizedQuestions: question.questions,
		awaitingPlanApproval: false,
	};
}

export function getStaleQuestionIdsForTurnComplete(
	questions: readonly QuestionRequest[],
	entries: readonly SessionEntry[]
): string[] {
	const staleIds: string[] = [];

	for (const question of questions) {
		const toolCallId = getQuestionToolCallId(question);
		const existingEntry = entries.find(
			(entry): entry is Extract<SessionEntry, { type: "tool_call" }> =>
				isToolCallEntry(entry) && entry.message.id === toolCallId
		);

		if (!existingEntry) {
			continue;
		}

		const status = existingEntry.message.status;
		if (status !== "pending" && status !== "in_progress") {
			staleIds.push(question.id);
		}
	}

	return staleIds;
}

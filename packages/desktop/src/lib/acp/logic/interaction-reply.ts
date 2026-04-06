import type { ResultAsync } from "neverthrow";

import { AgentError, type AppError } from "../errors/app-error.js";
import type { AcpError } from "../errors/acp-error.js";
import { api } from "../store/api.js";
import type { PermissionReply, PermissionRequest } from "../types/permission.js";
import type { QuestionAnswer, QuestionRequest } from "../types/question.js";
import {
	cancelQuestion,
	respondToPermission,
	respondToPlanApproval,
	respondToQuestion,
} from "./inbound-request-handler.js";

interface InteractionReplyTarget {
	sessionId: string;
	id: string;
	jsonRpcRequestId?: number;
}

interface JsonRpcInteractionReplyStrategy {
	kind: "json-rpc";
	sessionId: string;
	requestId: number;
}

interface HttpInteractionReplyStrategy {
	kind: "http";
	sessionId: string;
	requestId: string;
}

type InteractionReplyStrategy = JsonRpcInteractionReplyStrategy | HttpInteractionReplyStrategy;

function createInteractionReplyStrategy(
	target: InteractionReplyTarget
): InteractionReplyStrategy {
	if (target.jsonRpcRequestId !== undefined) {
		return {
			kind: "json-rpc",
			sessionId: target.sessionId,
			requestId: target.jsonRpcRequestId,
		};
	}

	return {
		kind: "http",
		sessionId: target.sessionId,
		requestId: target.id,
	};
}

function toReplyError(action: string, error: AcpError): AppError {
	return new AgentError(action, new Error(error.message));
}

export function replyToPermissionRequest(
	permission: PermissionRequest,
	reply: PermissionReply,
	optionId: string
): ResultAsync<void, AppError> {
	const strategy = createInteractionReplyStrategy(permission);

	if (strategy.kind === "json-rpc") {
		const allowed = reply !== "reject";
		return respondToPermission(strategy.sessionId, strategy.requestId, allowed, optionId).mapErr(
			(error) => toReplyError("replyPermission", error)
		);
	}

	return api.replyPermission(strategy.sessionId, strategy.requestId, reply);
}

export function replyToQuestionRequest(
	question: QuestionRequest,
	answers: QuestionAnswer[],
	answerMap: Record<string, string | string[]>
): ResultAsync<void, AppError> {
	const strategy = createInteractionReplyStrategy(question);

	if (strategy.kind === "json-rpc") {
		return respondToQuestion(strategy.sessionId, strategy.requestId, answerMap).mapErr((error) =>
			toReplyError("replyQuestion", error)
		);
	}

	return api.replyQuestion(strategy.sessionId, strategy.requestId, answers);
}

export function cancelQuestionRequest(question: QuestionRequest): ResultAsync<void, AppError> {
	const strategy = createInteractionReplyStrategy(question);

	if (strategy.kind === "json-rpc") {
		return cancelQuestion(strategy.sessionId, strategy.requestId).mapErr((error) =>
			toReplyError("cancelQuestion", error)
		);
	}

	return api.replyQuestion(strategy.sessionId, strategy.requestId, []);
}

export function replyToPlanApprovalRequest(
	sessionId: string,
	jsonRpcRequestId: number,
	approved: boolean
): ResultAsync<void, AcpError> {
	return respondToPlanApproval(sessionId, jsonRpcRequestId, approved);
}

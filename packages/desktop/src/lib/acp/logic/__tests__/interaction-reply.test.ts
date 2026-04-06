import { okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PermissionRequest } from "../../types/permission.js";
import type { QuestionAnswer, QuestionRequest } from "../../types/question.js";
import {
	cancelQuestionRequest,
	replyToPermissionRequest,
	replyToPlanApprovalRequest,
	replyToQuestionRequest,
} from "../interaction-reply.js";

const mockReplyPermission = vi.fn(
	(_sessionId: string, _permissionId: string, _reply: "once" | "always" | "reject") =>
		okAsync(undefined)
);

const mockReplyQuestion = vi.fn(
	(_sessionId: string, _questionId: string, _answers: QuestionAnswer[]) => okAsync(undefined)
);

const mockRespondToPermission = vi.fn(
	(_sessionId: string, _requestId: number, _allowed: boolean, _optionId: string) =>
		okAsync(undefined)
);

const mockRespondToQuestion = vi.fn(
	(_sessionId: string, _requestId: number, _answers: Record<string, string | string[]>) =>
		okAsync(undefined)
);

const mockCancelQuestion = vi.fn((_sessionId: string, _requestId: number) => okAsync(undefined));
const mockRespondToPlanApproval = vi.fn(
	(_sessionId: string, _requestId: number, _approved: boolean) => okAsync(undefined)
);

vi.mock("../../store/api.js", () => ({
	api: {
		replyPermission: (sessionId: string, permissionId: string, reply: "once" | "always" | "reject") =>
			mockReplyPermission(sessionId, permissionId, reply),
		replyQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) =>
			mockReplyQuestion(sessionId, questionId, answers),
	},
}));

vi.mock("../inbound-request-handler.js", () => ({
	respondToPermission: (
		sessionId: string,
		requestId: number,
		allowed: boolean,
		optionId: string
	) => mockRespondToPermission(sessionId, requestId, allowed, optionId),
	respondToQuestion: (
		sessionId: string,
		requestId: number,
		answers: Record<string, string | string[]>
	) => mockRespondToQuestion(sessionId, requestId, answers),
	cancelQuestion: (sessionId: string, requestId: number) =>
		mockCancelQuestion(sessionId, requestId),
	respondToPlanApproval: (sessionId: string, requestId: number, approved: boolean) =>
		mockRespondToPlanApproval(sessionId, requestId, approved),
}));

describe("interaction reply", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("replyToPermissionRequest", () => {
		it("routes ACP permissions through JSON-RPC responders", async () => {
			const permission: PermissionRequest = {
				id: "permission-1",
				sessionId: "session-jsonrpc",
				jsonRpcRequestId: 42,
				permission: "ReadFile",
				patterns: [],
				metadata: {},
				always: [],
			};

			await replyToPermissionRequest(permission, "once", "allow");

			expect(mockRespondToPermission).toHaveBeenCalledWith("session-jsonrpc", 42, true, "allow");
			expect(mockReplyPermission).not.toHaveBeenCalled();
		});

		it("routes stream permissions through the HTTP reply endpoint", async () => {
			const permission: PermissionRequest = {
				id: "permission-2",
				sessionId: "session-http",
				permission: "ReadFile",
				patterns: [],
				metadata: {},
				always: [],
			};

			await replyToPermissionRequest(permission, "reject", "reject");

			expect(mockReplyPermission).toHaveBeenCalledWith("session-http", "permission-2", "reject");
			expect(mockRespondToPermission).not.toHaveBeenCalled();
		});
	});

	describe("replyToQuestionRequest", () => {
		it("routes ACP questions through JSON-RPC responders", async () => {
			const question: QuestionRequest = {
				id: "question-1",
				sessionId: "session-jsonrpc",
				jsonRpcRequestId: 99,
				questions: [],
			};
			const answers: QuestionAnswer[] = [{ questionIndex: 0, answers: ["Svelte"] }];
			const answerMap = { Framework: "Svelte" };

			await replyToQuestionRequest(question, answers, answerMap);

			expect(mockRespondToQuestion).toHaveBeenCalledWith("session-jsonrpc", 99, answerMap);
			expect(mockReplyQuestion).not.toHaveBeenCalled();
		});

		it("routes stream questions through the HTTP reply endpoint", async () => {
			const question: QuestionRequest = {
				id: "question-2",
				sessionId: "session-http",
				questions: [],
			};
			const answers: QuestionAnswer[] = [{ questionIndex: 0, answers: ["Bun"] }];
			const answerMap = { Runtime: "Bun" };

			await replyToQuestionRequest(question, answers, answerMap);

			expect(mockReplyQuestion).toHaveBeenCalledWith("session-http", "question-2", answers);
			expect(mockRespondToQuestion).not.toHaveBeenCalled();
		});
	});

	describe("cancelQuestionRequest", () => {
		it("routes ACP cancellations through JSON-RPC responders", async () => {
			const question: QuestionRequest = {
				id: "question-3",
				sessionId: "session-jsonrpc",
				jsonRpcRequestId: 123,
				questions: [],
			};

			await cancelQuestionRequest(question);

			expect(mockCancelQuestion).toHaveBeenCalledWith("session-jsonrpc", 123);
			expect(mockReplyQuestion).not.toHaveBeenCalled();
		});

		it("routes stream cancellations through the HTTP reply endpoint", async () => {
			const question: QuestionRequest = {
				id: "question-4",
				sessionId: "session-http",
				questions: [],
			};

			await cancelQuestionRequest(question);

			expect(mockReplyQuestion).toHaveBeenCalledWith("session-http", "question-4", []);
			expect(mockCancelQuestion).not.toHaveBeenCalled();
		});
	});

	describe("replyToPlanApprovalRequest", () => {
		it("routes plan approval replies through the shared responder", async () => {
			await replyToPlanApprovalRequest("session-plan", 77, true);

			expect(mockRespondToPlanApproval).toHaveBeenCalledWith("session-plan", 77, true);
		});
	});
});

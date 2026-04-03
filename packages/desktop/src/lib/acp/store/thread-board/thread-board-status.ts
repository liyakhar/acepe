export type ThreadBoardStatus =
	| "answer_needed"
	| "planning"
	| "working"
	| "finished"
	| "idle"
	| "error";

export const THREAD_BOARD_STATUS_ORDER: readonly ThreadBoardStatus[] = [
	"answer_needed",
	"planning",
	"working",
	"finished",
	"idle",
	"error",
];
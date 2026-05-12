<script lang="ts">
/**
 * Demo: Answer Needed State
 * Shows a queue item with a pending question requiring user input.
 */
import { SectionedFeed, ActivityEntry, TAG_COLORS, Colors, COLOR_NAMES } from "@acepe/ui";
import type {
	SectionedFeedGroup,
	ActivityEntryQuestion,
	ActivityEntryQuestionOption,
} from "@acepe/ui";

interface DemoItem {
	readonly id: string;
	readonly title: string;
	readonly mode: "build" | "plan" | null;
	readonly timeAgo: string;
	readonly insertions: number;
	readonly deletions: number;
	readonly isStreaming: boolean;
	readonly statusText: string | null;
	readonly showStatusShimmer: boolean;
	readonly fileToolDisplayText: string | null;
	readonly toolContent: string | null;
	readonly showToolShimmer: boolean;
	readonly taskSubagentSummaries: readonly string[];
	readonly showTaskSubagentList: boolean;
	readonly todoProgress: { current: number; total: number; label: string } | null;
	readonly question: ActivityEntryQuestion | null;
	readonly projectName: string;
	readonly projectColor: string;
}

const demoItem: DemoItem = {
	id: "auth-demo",
	title: "Implementing authentication module",
	mode: "build",
	timeAgo: "now",
	insertions: 0,
	deletions: 0,
	isStreaming: false,
	statusText: null,
	showStatusShimmer: false,
	fileToolDisplayText: null,
	toolContent: null,
	showToolShimmer: false,
	taskSubagentSummaries: [],
	showTaskSubagentList: false,
	todoProgress: null,
	question: {
		question: "Which authentication strategy should I use?",
		multiSelect: false,
		options: [{ label: "JWT tokens" }, { label: "Session cookies" }],
	},
	projectName: "acme-api",
	projectColor: TAG_COLORS[1],
};

const billingQuestionItem: DemoItem = {
	id: "billing-demo",
	title: "Stripe webhook retry policy",
	mode: "build",
	timeAgo: "2m",
	insertions: 0,
	deletions: 0,
	isStreaming: false,
	statusText: null,
	showStatusShimmer: false,
	fileToolDisplayText: null,
	toolContent: null,
	showToolShimmer: false,
	taskSubagentSummaries: [],
	showTaskSubagentList: false,
	todoProgress: null,
	question: {
		question: "Retry failed webhooks how?",
		multiSelect: false,
		options: [{ label: "Exponential backoff" }, { label: "Dead-letter queue" }],
	},
	projectName: "billing",
	projectColor: TAG_COLORS[3],
};

const reviewItem: DemoItem = {
	id: "dashboard-review",
	title: "Refactor dashboard charts",
	mode: "build",
	timeAgo: "5m",
	insertions: 184,
	deletions: 92,
	isStreaming: false,
	statusText: "Ready for review · 12 files",
	showStatusShimmer: false,
	fileToolDisplayText: null,
	toolContent: null,
	showToolShimmer: false,
	taskSubagentSummaries: [],
	showTaskSubagentList: false,
	todoProgress: null,
	question: null,
	projectName: "web",
	projectColor: TAG_COLORS[5],
};

const groups: readonly SectionedFeedGroup<DemoItem>[] = [
	{
		id: "answer_needed",
		label: "Input Needed",
		items: [demoItem, billingQuestionItem],
	},
	{
		id: "needs_review",
		label: "Needs Review",
		items: [reviewItem],
	},
];

// Interactive state — per-item answer tracking
let selectedItemId = $state<string | null>(null);
let answersByItem = $state<Record<string, string | null>>({});

const QUESTION_COLORS = [
	Colors[COLOR_NAMES.GREEN],
	Colors[COLOR_NAMES.RED],
	Colors[COLOR_NAMES.PINK],
	Colors[COLOR_NAMES.ORANGE],
];

function getQuestionOptions(item: DemoItem): readonly ActivityEntryQuestionOption[] {
	if (!item.question) return [];
	const selected = answersByItem[item.id] ?? null;
	return item.question.options.map((opt, i) => ({
		label: opt.label,
		selected: selected === opt.label,
		color: QUESTION_COLORS[i % QUESTION_COLORS.length],
	}));
}

function handleAnswerChange(itemId: string, answerId: string) {
	answersByItem = {
		...answersByItem,
		[itemId]: answersByItem[itemId] === answerId ? null : answerId,
	};
}
</script>

<div class="demo-container">
	<SectionedFeed
		{groups}
		totalCount={3}
	>
		{#snippet itemRenderer(rawItem)}
			{@const item = rawItem as DemoItem}
			{#snippet projectBadge()}
				<span
					class="flex h-4 w-4 items-center justify-center rounded text-[10px] font-medium"
					style="background-color: {item.projectColor}; color: white;"
				>
					{item.projectName.charAt(0)}
				</span>
			{/snippet}
			<ActivityEntry
				selected={selectedItemId === item.id}
				onSelect={() => {
					selectedItemId = item.id;
				}}
				mode={item.mode}
				title={item.title}
				timeAgo={item.timeAgo}
				insertions={item.insertions}
				deletions={item.deletions}
				{projectBadge}
				isStreaming={item.isStreaming}
				taskDescription={null}
				taskSubagentSummaries={item.taskSubagentSummaries}
				showTaskSubagentList={item.showTaskSubagentList}
				fileToolDisplayText={item.fileToolDisplayText}
				toolContent={item.toolContent}
				showToolShimmer={item.showToolShimmer}
				statusText={item.statusText}
				showStatusShimmer={item.showStatusShimmer}
				todoProgress={item.todoProgress}
				currentQuestion={item.question
					? {
							question: item.question.question,
							multiSelect: item.question.multiSelect,
							options: item.question.options.map((o) => ({ label: o.label }))
						}
					: null}
				totalQuestions={item.question ? 1 : 0}
				hasMultipleQuestions={false}
				currentQuestionIndex={0}
				questionId={item.id}
				questionProgress={[]}
				currentQuestionAnswered={!!answersByItem[item.id]}
				currentAnswerDisplay={answersByItem[item.id] ?? ''}
				currentQuestionOptions={getQuestionOptions(item)}
				otherText={''}
				otherPlaceholder={'Type your answer...'}
				showSubmitButton={!!answersByItem[item.id]}
				canSubmit={!!answersByItem[item.id]}
				submitLabel={'Submit'}
				onOptionSelect={(optionLabel) => handleAnswerChange(item.id, optionLabel)}
				onOtherInput={() => {}}
				onOtherKeydown={() => {}}
				onSubmitAll={() => {}}
				onNextQuestion={() => {}}
				onPrevQuestion={() => {}}
			/>
		{/snippet}
	</SectionedFeed>
</div>

<style>
	.demo-container {
		width: 100%;
	}
</style>

<script lang="ts">
import { GitBranch, ChatCircle, Lightning } from "phosphor-svelte";

import LandingDemoFrame from "./landing-demo-frame.svelte";
import { websiteThemeStore } from "$lib/theme/theme.js";

interface IllustrationCard {
	id: string;
	titleWidth: number;
	agent: "claude" | "codex" | "cursor" | "opencode";
	projectColor: string;
	insertions: number;
	deletions: number;
	accent?: "streaming" | "question" | "review" | "done" | null;
}

interface IllustrationColumn {
	id: string;
	label: string;
	color: string;
	count: number;
	cards: readonly IllustrationCard[];
}

const theme = $derived($websiteThemeStore);

function agentIcon(agent: IllustrationCard["agent"], t: string): string {
	if (agent === "codex") return `/svgs/agents/codex/codex-icon-${t}.svg`;
	if (agent === "cursor") return `/svgs/agents/cursor/cursor-icon-${t}.svg`;
	if (agent === "opencode") return `/svgs/agents/opencode/opencode-logo-${t}.svg`;
	return `/svgs/agents/claude/claude-icon-${t}.svg`;
}

const columns: readonly IllustrationColumn[] = [
	{
		id: "input",
		label: "Input needed",
		color: "#FFB020",
		count: 1,
		cards: [
			{
				id: "c1",
				titleWidth: 78,
				agent: "claude",
				projectColor: "#9858FF",
				insertions: 4,
				deletions: 0,
				accent: "question",
			},
		],
	},
	{
		id: "planning",
		label: "Planning",
		color: "#4AD0FF",
		count: 2,
		cards: [
			{
				id: "c2",
				titleWidth: 82,
				agent: "cursor",
				projectColor: "#18D6C3",
				insertions: 11,
				deletions: 2,
				accent: "streaming",
			},
			{
				id: "c3",
				titleWidth: 70,
				agent: "claude",
				projectColor: "#9858FF",
				insertions: 8,
				deletions: 0,
				accent: "streaming",
			},
		],
	},
	{
		id: "working",
		label: "Working",
		color: "#9858FF",
		count: 2,
		cards: [
			{
				id: "c4",
				titleWidth: 88,
				agent: "codex",
				projectColor: "#4AD0FF",
				insertions: 38,
				deletions: 9,
				accent: "streaming",
			},
			{
				id: "c5",
				titleWidth: 74,
				agent: "opencode",
				projectColor: "#FF8D20",
				insertions: 6,
				deletions: 1,
				accent: "streaming",
			},
		],
	},
	{
		id: "review",
		label: "Needs Review",
		color: "#FF78F7",
		count: 2,
		cards: [
			{
				id: "c6",
				titleWidth: 84,
				agent: "claude",
				projectColor: "#9858FF",
				insertions: 52,
				deletions: 14,
				accent: "review",
			},
			{
				id: "c7",
				titleWidth: 68,
				agent: "codex",
				projectColor: "#4AD0FF",
				insertions: 29,
				deletions: 11,
				accent: "review",
			},
		],
	},
	{
		id: "done",
		label: "Done",
		color: "#22C55E",
		count: 2,
		cards: [
			{
				id: "c8",
				titleWidth: 76,
				agent: "cursor",
				projectColor: "#18D6C3",
				insertions: 14,
				deletions: 4,
				accent: "done",
			},
			{
				id: "c9",
				titleWidth: 72,
				agent: "opencode",
				projectColor: "#FF8D20",
				insertions: 21,
				deletions: 5,
				accent: "done",
			},
		],
	},
];

interface Props {
	bare?: boolean;
}

let { bare = false }: Props = $props();
</script>

<LandingDemoFrame {bare}>
	{#snippet children()}
		<div class="kanban-illustration h-full w-full">
			<div class="board">
				{#each columns as column (column.id)}
					<div class="column">
						<div class="column-header">
							<span class="column-dot" style="background: {column.color};"></span>
							<span class="column-label">{column.label}</span>
							<span class="column-count">{column.count}</span>
						</div>
						<div class="column-body">
							{#each column.cards as card (card.id)}
								<div class="card">
									<div class="card-top">
										<div class="card-agent">
											<img src={agentIcon(card.agent, theme)} alt="" />
										</div>
										<span class="card-project-dot" style="background: {card.projectColor};"></span>
										<div class="card-spacer"></div>
										{#if card.accent === "streaming"}
											<span class="card-pulse"></span>
										{/if}
									</div>
									<div class="card-title-row">
										<div class="card-title-line" style="width: {card.titleWidth}%;"></div>
										<div class="card-title-line short" style="width: {Math.max(card.titleWidth - 30, 35)}%;"></div>
									</div>
									<div class="card-footer">
										<div class="card-diff">
											<span class="diff-add">+{card.insertions}</span>
											{#if card.deletions > 0}
												<span class="diff-del">−{card.deletions}</span>
											{/if}
										</div>
										{#if card.accent === "question"}
											<span class="card-chip chip-question">
												<ChatCircle class="size-3" weight="fill" />
												Answer
											</span>
										{:else if card.accent === "review"}
											<span class="card-chip chip-review">
												<GitBranch class="size-3" weight="fill" />
												PR
											</span>
										{:else if card.accent === "streaming"}
											<span class="card-chip chip-streaming">
												<Lightning class="size-3" weight="fill" />
												Live
											</span>
										{:else if card.accent === "done"}
											<span class="card-chip chip-done">✓</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/snippet}
</LandingDemoFrame>

<style>
	.kanban-illustration {
		display: flex;
		padding: 1rem 0.875rem;
		background:
			radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--foreground) 4%, transparent) 0%, transparent 60%),
			var(--background);
	}

	.board {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.625rem;
		width: 100%;
		height: 100%;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.5rem 0.5rem 0.625rem;
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--foreground) 3%, transparent);
		border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.column-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0.125rem 0.25rem;
		border-bottom: 1px dashed color-mix(in srgb, var(--foreground) 10%, transparent);
	}

	.column-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		box-shadow: 0 0 8px currentColor;
	}

	.column-label {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.column-count {
		margin-left: auto;
		font-size: 0.625rem;
		font-weight: 500;
		color: var(--muted-foreground);
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.column-body {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
		min-height: 0;
		flex: 1;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
		padding: 0.5rem 0.5625rem;
		border-radius: 0.5rem;
		background: var(--background);
		border: 1px solid color-mix(in srgb, var(--foreground) 9%, transparent);
		box-shadow: 0 1px 0 color-mix(in srgb, var(--foreground) 4%, transparent);
	}

	.card-top {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
	}

	.card-agent {
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 999px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
	}

	.card-agent img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.card-project-dot {
		width: 0.3125rem;
		height: 0.3125rem;
		border-radius: 999px;
	}

	.card-spacer {
		flex: 1;
	}

	.card-pulse {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 999px;
		background: #22C55E;
		box-shadow: 0 0 6px #22C55E;
		animation: pulse 1.6s ease-in-out infinite;
	}

	.card-title-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.card-title-line {
		height: 0.375rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 22%, transparent);
	}

	.card-title-line.short {
		background: color-mix(in srgb, var(--foreground) 12%, transparent);
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.375rem;
	}

	.card-diff {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.5625rem;
		font-weight: 600;
	}

	.diff-add {
		color: #22C55E;
	}

	.diff-del {
		color: #FF5D5A;
	}

	.card-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		padding: 0.0625rem 0.3125rem;
		font-size: 0.5625rem;
		font-weight: 600;
		border-radius: 999px;
		line-height: 1;
	}

	.chip-question {
		color: #FFB020;
		background: color-mix(in srgb, #FFB020 16%, transparent);
	}

	.chip-review {
		color: #FF78F7;
		background: color-mix(in srgb, #FF78F7 16%, transparent);
	}

	.chip-streaming {
		color: #4AD0FF;
		background: color-mix(in srgb, #4AD0FF 16%, transparent);
	}

	.chip-done {
		color: #22C55E;
		background: color-mix(in srgb, #22C55E 16%, transparent);
		padding: 0.0625rem 0.375rem;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.55;
			transform: scale(0.85);
		}
	}
</style>

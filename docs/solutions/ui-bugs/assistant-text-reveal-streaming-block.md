---
title: Assistant text reveal needs presentation lifecycle separate from streaming state
date: 2026-05-02
category: ui-bugs
module: agent-panel
problem_type: ui_bug
component: assistant
severity: high
symptoms:
  - Assistant responses appeared as a single final block instead of progressively revealing
  - Text reveal did not animate on completed turns because canonical isStreaming was already false
  - Cold history entries and freshly observed live turns shared the same reveal lifecycle
  - Virtualized merged assistant rows could lose reveal metadata or use a mismatched reveal key
root_cause: logic_error
resolution_type: code_fix
related_components:
  - session-graph
  - markdown-rendering
  - virtualization
tags:
  - agent-panel
  - assistant
  - streaming
  - reveal
  - markdown
  - viewport
  - presentation-state
  - session-graph
---

# Assistant text reveal needs presentation lifecycle separate from streaming state

## Problem

Assistant responses in the agent panel could appear as one completed block instead of revealing progressively. The failure was not just a bad streaming flag: canonical generation state and mounted-panel presentation lifecycle had been treated as the same thing.

The clean architecture is:

```text
SessionStateGraph
  -> pure display model
  -> cosmetic reveal projector
  -> passive renderer
  -> word fade decoration
```

The graph answers "what happened." The display model answers "what text should be visible now." The projector answers "does this visible text still need animation support." Markdown only decorates text it has already received.

## Symptoms

- A long assistant answer appeared all at once after generation, with no visible streaming reveal.
- Attempts to patch viewport streaming flags did not fix the problem because completed full-text rows still lacked an explicit reveal intent.
- Flicker could appear as a side effect of trying to infer reveal state from remounts, native fallback, or MarkdownText caches.
- Consecutive assistant scene rows merged by the virtualized display path could drop or mis-key reveal metadata.

## What Didn't Work

- **Using `isStreaming` as reveal authority.** `isStreaming` describes canonical generation state. It cannot distinguish a historical completed row from a completed row that arrived while this panel was mounted.
- **Moving reveal inference into the viewport.** The viewport owns layout, scroll, virtualization, and fallback protection. Letting it decide reveal semantics creates another source of product truth.
- **Clearing MarkdownText caches broadly.** Cache invalidation can hide one snap-to-full path while introducing flicker or losing useful remount progress.
- **Treating merged display rows as ordinary assistant rows.** The final visible text block can have a different grouped index than `message:0`, so fallback reveal keys must be computed from the grouped message shape.

## Solution

### Use a presentation-only reveal contract

Shared UI types now carry optional passive reveal metadata:

```ts
export interface AgentAssistantRevealRenderState {
	key: string;
	fadeStartOffset: number;
	shouldFade: boolean;
	isAdvancing: boolean;
	requiresStableTailMount: boolean;
}
```

This is not canonical session state. It is a presentation contract passed through `AgentAssistantEntry`, `AssistantRenderBlockContext`, `AgentPanelConversationEntry`, and scene rendering so the desktop host can decorate a specific visible text block.

### Project visible text and fade intent after semantic materialization

The reveal projector lives in the desktop agent-panel controller layer. It observes only mounted-panel facts:

- `sessionId`
- `turnState`
- `turnId`
- current display rows
- previous reveal memory

It returns separate facts:

- `visibleTextByRowKey`: projected text to render,
- `isAdvancing`: whether another RAF tick is needed,
- `shouldFade`/`fadeStartOffset`: whether newly visible words should fade,
- `requiresStableTailMount`: whether viewport layout should keep the live tail mounted.

It intentionally leaves cold completed history undecorated. If a live row completes while the panel still has reveal memory, the text snaps to full immediately and only the fresh suffix fades.

Important projector tests:

- cold completed scenes do not replay,
- live completion snaps to full text without losing fade intent,
- reduced motion and instant mode render full text with no fade,
- same-key rewrites never blank a non-empty row,
- final reveal step can stop advancement while still fading new words.

### Keep MarkdownText passive

`MarkdownText` does not own pacing, target text, remount recovery, or reveal lifecycle. It receives already-visible text and optional fade metadata.

Word fade is DOM decoration only:

```ts
use:canonicalStreamingWordFade={{
	active: revealRenderState?.shouldFade === true,
	marker: visibleHtml,
	resetKey: revealRenderState?.key ?? "",
	fadeStartOffset: revealRenderState?.fadeStartOffset ?? 0,
}}
```

If fade cannot safely wrap special content, MarkdownText renders correct content without bringing lifecycle logic back.

### Keep the viewport as layout protection only

`SceneContentViewport` treats `requiresStableTailMount` as layout protection. It does not create reveal intent. That distinction matters:

```ts
const hasLiveAssistantDisplayEntry = displayEntries.some(
	(entry) =>
		entry.type === "assistant_merged" &&
		(entry.isStreaming === true ||
			entry.revealRenderState?.requiresStableTailMount === true)
);
```

### Preserve reveal metadata through assistant row merging

Consecutive assistant scene rows can collapse into one `assistant_merged` display row. The merge path preserves the latest scene-provided passive reveal state and keeps text rendering authority in `markdown`/`message.chunks`.

```ts
revealRenderState: entry.revealRenderState
```

Fallback reveal keys are computed from grouped message chunks:

```ts
export function getMergedAssistantRevealFallbackKey(
	entry: MergedAssistantDisplayEntry
): string | null {
	const textGroupIndex = getLastMessageTextGroupIndex(entry);
	return textGroupIndex === null ? null : `${entry.key}:message:${String(textGroupIndex)}`;
}
```

This prevents permanent native fallback when a multi-text-group message deactivates `a1:message:2` but the viewport had pre-seeded `a1:message:0`.

## Why This Works

The core distinction is:

- **Canonical streaming state:** whether the agent/provider is still generating.
- **Presentation reveal lifecycle:** whether visible text is still advancing or newly visible words should fade.

A completed answer can still be new to the mounted panel. A historical answer can be completed and should not replay. `isStreaming` cannot express that difference; a presentation-only projector can.

By keeping the graph/display model pure and applying cosmetic reveal after text correctness is already decided, the system avoids dual canonical truth while still giving MarkdownText an explicit fade signal. The viewport remains a protection layer, not an authority layer.

## Prevention

- Do not use `isStreaming` as a proxy for "should animate this text." Use `isAdvancing` for RAF ticks and `shouldFade` for word fade.
- Keep `SessionStateGraph` and graph materializers semantic. Presentation lifecycles belong in mounted controllers/projectors.
- Do not put rendered text into shared reveal metadata. Scene entry `markdown` and `message.chunks` own visible text.
- Do not let child renderers report reveal activity to the viewport. The viewport reads model-provided layout hints only.
- Test final reveal steps, completion snaps, cold completed history, same-key rewrites, reduced motion, and instant mode.
- Keep repro-lab diagnostics machine-readable: visible length, canonical length, advancement state, fade intent, fade offset, and DOM fade span/style data.

## Related Issues

- `docs/solutions/best-practices/agent-panel-content-viewport-reactivity-renderer-2026-05-01.md` describes the broader viewport rule: keep rows scene-owned and keep the viewport responsible for layout rather than row semantics.
- `docs/solutions/ui-bugs/agent-panel-graph-materialization-rendering-bug-2026-04-28.md` covers the canonical graph-to-scene materialization boundary this fix preserves.
- `docs/solutions/best-practices/canonical-session-projection-ui-derivation-2026-05-01.md` covers canonical projection authority; reveal freshness is presentation-only and should not become another canonical projection field.

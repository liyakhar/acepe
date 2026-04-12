---
title: Always define snippet props unconditionally in Svelte 5
date: 2026-04-12
last_updated: 2026-04-12
category: best-practices
module: ui (agent-panel-scene)
problem_type: best_practice
component: Svelte 5 snippet props
severity: high
applies_when:
  - a child component needs to conditionally provide a snippet prop to a parent
  - snippet slots like topBar, preComposer are optional in the parent component
  - you want to show/hide content in a snippet slot based on runtime state
symptoms:
  - snippet content silently does not render despite being defined
  - parent component receives undefined for snippet props wrapped in {#if}
  - other unconditional snippets (composer, footer) render fine while conditional ones don't
tags:
  - svelte5
  - snippets
  - conditional-rendering
  - silent-failure
---

## Problem

In Svelte 5, wrapping a `{#snippet}` definition inside `{#if}` prevents the snippet from being passed as an implicit prop to the parent component — even when the condition evaluates to `true`.

```svelte
<!-- ❌ BROKEN: snippet never reaches ParentComponent as a prop -->
<ParentComponent>
  {#if shouldShowTopBar}
    {#snippet topBar()}
      <MyContent />
    {/snippet}
  {/if}
</ParentComponent>
```

The parent receives `topBar = undefined` regardless of `shouldShowTopBar`'s value. This fails silently — no error, no warning.

## Root Cause

Svelte 5 snippet props defined inside component tags are compiled into implicit prop bindings at compile time. When the `{#snippet}` is nested inside `{#if}`, the compiler either skips the binding or creates it in a conditional branch that doesn't execute as expected during SSR/hydration.

## Solution

Always define snippet props **unconditionally**. Move the condition **inside** the snippet body:

```svelte
<!-- ✅ CORRECT: snippet is always defined, condition is inside -->
<ParentComponent>
  {#snippet topBar()}
    {#if shouldShowTopBar}
      <MyContent />
    {/if}
  {/snippet}
</ParentComponent>
```

This matches how `composer` and `footer` snippets were already structured in `AgentPanelScene` (and those always worked).

## Files Changed

- `packages/ui/src/components/agent-panel-scene/agent-panel-scene.svelte` — converted `topBar` and `preComposer` snippet definitions from conditional to unconditional

## Impact

Fixed website demo where `preComposerOverride` and `topBarOverride` snippets were provided to `AgentPanelScene` but never rendered. Five real desktop components (PermissionBar, WorktreeSetupCard, ModifiedFilesHeader, TodoHeader, PlanHeader) became visible after this fix.

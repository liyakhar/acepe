---
date: 2026-04-09
topic: acepe-pitch
---

# Acepe Investor Pitch Website

## Problem Frame

Acepe needs an investor-facing pitch that does more than describe the product. It should frame Acepe as a category-defining company, communicate the problem with current AI coding workflows, and present the product in a format that works both as a polished website and as exportable PDF slides. The pitch should reuse Acepe's existing visual language so it feels native to the product rather than like a separate marketing artifact.

## Requirements

**Narrative and Positioning**
- R1. The first version must be designed for a seed / pre-seed investor audience.
- R2. The title slide must frame Acepe as a category-level product, using the current preferred line: "Acepe is the developer workspace for managing AI agents at production quality."
- R3. The primary problem framing must emphasize developer time lost to context-switching across tools instead of supervising one reliable multi-agent workflow.
- R4. The deck should feel like a tight investor presentation first, and a browsable website second.

**Format and Experience**
- R5. The pitch must have a website-first source of truth with export to PDF slides.
- R6. The website experience should be structured as a slide-like narrative rather than a generic marketing site.
- R7. The PDF export should preserve slide readability and presentation flow without requiring a separately maintained slide deck.
- R8. The first version should target a tight seed-style narrative structure of roughly 8-10 slide sections, centered on title, problem, solution, product, market, traction, business model, team, and ask.
- R9. The first version must define a canonical presentation arc so both the website and PDF tell the same investor story in the same order.

**Branding and Visual Direction**
- R10. The pitch must reuse Acepe's existing splash / brand visual language from the product rather than inventing a disconnected style.
- R11. The opening section should use Acepe's existing splashscreen treatment as the basis for the hero / title-slide moment.
- R12. Brand reuse must be concrete enough to guide implementation, including background treatment, typography feel, card / chrome patterns, logo treatment, and motion restraint.

**Presentation UX**
- R13. The pitch must support presentation-style navigation with clear next / previous progression, progress awareness, and deep-linkable sections.
- R14. The first version must define whether it behaves as one-screen-per-slide or as controlled section scrolling before implementation planning starts.
- R15. The investor story should work in both live-presented mode and self-guided reading mode.

**Content and Proof**
- R16. The first version may use placeholder business metrics where exact values are not yet available, but it must present current product proof honestly.
- R17. Early traction should be framed as credible seed-stage signal, including current known proof points such as hundreds of users and 40 GitHub stars, until more exact metrics are available.

## Success Criteria
- The pitch can be shown to an investor as a coherent seed-stage story without needing a separate deck format.
- The website presentation feels visually native to Acepe branding.
- The export path to PDF slides is part of the intended experience, not an afterthought.
- The content positions Acepe as a serious multi-agent developer product with production-quality workflow control.

## Scope Boundaries
- The first version does not need final fundraising numbers, detailed financial projections, or exact market sizing.
- The first version does not need a PowerPoint-first workflow.
- The first version does not need a separate visual identity distinct from Acepe's current product brand.

## Key Decisions
- Website-first source of truth: The user wants the pitch to exist primarily as a website, with PDF slides generated from that experience.
- Investor audience: The first version is for seed / pre-seed investors, not customers or recruiting.
- Existing ecosystem reuse: Acepe already uses SvelteKit / Svelte / Tailwind and already has branded splash treatments in the product, so the pitch should reuse that ecosystem and visual language.
- Pitch skill usage: The `pitch-deck` skill is available and should help with pitch structure and messaging, but the rendering approach should remain web-native rather than PPTX-first.
- Canonical story arc: The default narrative should move through title, problem, why current workflows fail, product / system view, traction, market / why now, business model, team, and ask.

## Dependencies / Assumptions
- Existing splash and logo treatments are available in the Acepe codebase, including the visual patterns used in `packages/desktop/src/lib/acp/components/welcome-screen/welcome-screen.svelte` and `packages/desktop/src/lib/components/update-available/update-available-page.svelte`.
- The existing website package in `packages/website` is the likely home for the pitch unless planning finds a better repo-local structure.

## Outstanding Questions

### Deferred to Planning
- [Affects R5][Technical] What is the best export mechanism for PDF slides while keeping the website as the source of truth?
- [Affects R14][Technical] Should the presentation structure be route-per-slide, section-per-slide, or hybrid?
- [Affects R16][Needs research] What exact current user metric should replace the placeholder "hundreds of users" line?
- [Affects R17][Needs research] What additional seed-stage proof points are available beyond users and GitHub stars?

## Next Steps
-> /ce:plan for structured implementation planning

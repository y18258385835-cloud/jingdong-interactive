# AETHER Scene Design System

## Scope

This system applies to AI-generated scenes only. Existing manual editing,
asset import, timeline editing, inspector changes, and playback behavior keep
their current rules.

## Default Direction

`industrial-instrument`: industrial instrumentation, broadcast control room,
and Swiss information design. The visual goal is calm hierarchy and readable
data, not decorative cyberpunk effects.

## Tokens

```text
canvas.background  #07111D
canvas.surface     #0D1B2A
text.primary       #F8FAFC
text.secondary     #8BA4BC
accent.primary     #22D3EE
accent.secondary   #7C3AED
status.good        #34D399
status.warning     #F59E0B
status.critical    #FB7185
```

## Layout Rules

- Use a 12-column conceptual grid.
- Keep at least 6% left and right margins.
- Reserve 18-22% of the top area for title, subtitle, and divider.
- Use one primary title, up to three top-level metric panels, and one lower
  trend/event split.
- Keep same-row elements aligned and equally tall.
- Keep at least 2% gap between sibling panels.
- Keep every element inside the canvas bounds.
- Use one background effect at most; it is always the first visual layer and
  never participates in collision avoidance.

## Type Rules

- Title: 28-36px, one line where possible.
- Supporting text: 12-14px.
- Data labels: 10-12px; never use decorative microcopy as primary information.
- Do not use more than three visual emphasis colors in one scene.

## Motion Rules

- Default motion is subtle and short.
- Motion must communicate entry, state, or data change.
- No animation may change the authored layout during editor preview.

## Quality Gate

An AI proposal is ready only when it passes bounds, collision, hierarchy,
contrast, typography, and effect-count checks. A failed check stays in the
preview and must not be silently written into the project.

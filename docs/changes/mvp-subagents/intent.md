# Intent: mvp-subagents

## Why

Two kinds of checking are done by the same session that wrote the change: the review in `docs/REVIEW.md`, which must be independent of the implementing agent (REVIEW.md section 1), and the by-eye check of the screens against the brand and the spec (V-M01, V-M04). Project subagents give each a fresh context, a cheaper model and a fixed, read-only set of tools.

## What

Two project subagents in `.claude/agents/`, both on Sonnet:

- **reviewer**: reviews the changes on a branch with `docs/REVIEW.md` and reports its findings by severity. It reads files, runs commands that read (`git diff`, `git log`, `git show`, `grep` and the like) and the checks in REVIEW.md 13C, and saves its report as `docs/changes/<branch>/review-<n>.md`, as REVIEW.md section 12 says. It changes no other file.
- **ui-check**: checks the running app in the browser with the Playwright MCP server. It opens each page, takes a screenshot, checks it against the brand skill and `docs/spec.md`, and reports anything off-brand or broken. Its screenshots go in `.playwright-mcp/`, which git ignores, and it changes no code.

## Out of scope

No product change. No change to `docs/REVIEW.md`'s policy. The engineer makes the commits.

## Success

- Both agents are found by Claude Code from `.claude/agents/`, with the tools and model above.
- ui-check has no tool that edits files. The reviewer's instructions limit its writes to its own report and its shell use to reading and the 13C checks.
- `npm run check` passes.

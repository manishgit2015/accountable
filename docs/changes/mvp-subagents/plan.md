# Plan: mvp-subagents

## Tasks

| Task | Files | Done when |
|---|---|---|
| T1 reviewer agent | `.claude/agents/reviewer.md` | Tools `Read, Grep, Glob, Bash, Write, Edit`; model `sonnet`; follows REVIEW.md sections 2 to 13; runs the 13C checks itself; creates or updates only its report, `docs/changes/<branch>/review-<n>.md` (the engineer's decision, 26 Nov 2026) |
| T2 ui-check agent | `.claude/agents/ui-check.md` | Tools: Read, Grep, Glob and the Playwright MCP browser tools (the project's `playwright` server and the plugin's), without `browser_evaluate`, `browser_run_code_unsafe`, `browser_file_upload`, `browser_fill_form` or `browser_type`; model `sonnet`; preloads the `brand` skill; screenshots by file name only, so they land in `.playwright-mcp/`; changes no app data |
| T3 docs | `docs/spec.md` (ENG-12), `docs/STATUS.md`, `docs/build_logs.log` | The spec names both agents and their limits |

## Risks

- The reviewer's Bash, Write and Edit aren't limited by tool permissions, only by its instructions. Mitigation: it may write only its `review-<n>.md`, it has an explicit list of allowed and forbidden commands, and the PreToolUse `.env` hook still applies.
- The project's `.mcp.json` `playwright` server is disabled in this machine's `.claude/settings.local.json`, and the Playwright plugin is used instead, so the tool names differ. Mitigation: ui-check lists both servers' tools.

## Verification

- V1: `npm run check` passes.
- V2: each file's frontmatter parses, with the name, tools and model above.

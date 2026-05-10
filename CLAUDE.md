@AGENTS.md

## PR process

Before opening any pull request, you MUST complete all three gates in order:

1. **Build gate** — run `npm run build`. Fix all errors before proceeding. Do not skip.
2. **E2E gate** — run `npm run test:e2e`. All tests must pass.
3. **Playwright coverage** — every PR that adds or changes UI behaviour must include a Playwright test that exercises the golden path. Write the test as part of the implementation, not as an afterthought.

Do not open a PR until all three gates are green. If the e2e suite does not exist yet for a feature, write it first.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `phantomas1234/virtuoso`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.

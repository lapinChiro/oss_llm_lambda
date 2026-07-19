# Development workflow

1. State the behavior and risk before coding. Select the narrowest test layer that observes the contract.
2. Write a failing test, implement the smallest behavior, then refactor without weakening assertions.
3. For UI changes, review keyboard operation, labels, focus, loading/error/empty states, and narrow/wide layouts in a real browser.
4. Review responsibility, naming, duplication of knowledge, symmetry, file cohesion, comments, and error boundaries.
5. Run focused checks during development; run `npm run quality` and applicable Storybook/E2E/mutation gates before declaring completion.
6. Update README/docs, OpenAPI schemas, migrations, generated types, and examples in the same change when their source of truth changes.

Failures are evidence. Fix their root cause instead of adding type assertions, lint suppressions, retries, exclusions, or weaker tests. Comments should record why a decision exists, its invariant, and any source that must remain synchronized.

# Testing and quality gates

Risk determines the test layer:

| Layer | Protects | Command |
| --- | --- | --- |
| unit | service rules, composable concurrency, serialization | `npm test` |
| DB integration | migration, constraints, repositories, transactions | Backend Vitest suite |
| component/browser | semantics, keyboard flow, loading/error/empty/CRUD UI | `npm run test:storybook` |
| E2E | Frontend → API → PostgreSQL wiring | `npm run test:e2e` |
| mutation | whether important assertions detect changed behavior | `npm run test:mutation` |

`npm run quality` is the normal local/CI core: dependency consistency, type-check, lint, unit/integration tests, build, and Knip. `npm run quality:full` adds coverage, Storybook browser tests, and both mutation suites. E2E is separate because it owns Docker PostgreSQL; run it before release. CI runs these same workspace commands. Secret scanning uses `.github/workflows/gitleaks.yaml`; run the pinned betterleaks version locally when changing credentials, workflows, or deployment configuration.

Do not treat coverage as proof by itself. Assert observable contracts and boundary cases, then use mutation results to find assertions that do not constrain behavior.

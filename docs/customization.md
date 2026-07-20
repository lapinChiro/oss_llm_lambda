# Customizing the template

## Rename checklist

1. Change root `name`, description, license, and add your repository metadata.
2. Choose CDK `appName`, `databaseName`, region, and SSM prefix; update CD workflow `APP_NAME` to match.
3. Choose local container/database names only if parallel clones would collide.
4. Replace the title, design tokens, and favicon in `apps/frontend`.
5. Search active files for `webapp`, `app_dev`, `@app`, and example domains; each remaining occurrence should be an intentional default or example.

## Replace Todo safely

1. Define the new wire schemas/types in `packages/types` and write contract tests.
2. Add a migration with DB constraints, run up/down/up, then regenerate Kysely types.
3. Implement repository → service → API/route with integration and OpenAPI tests.
4. Implement API client → composable → view with unit and Storybook browser tests.
5. Add an E2E path that creates and deletes only data it owns.
6. Extend mutation targets to the new high-value decisions.
7. Remove Todo only after every generic abstraction has another concrete consumer or an explicit removal decision.

Keep environment-specific values in env/CDK context, not source. Avoid pre-building authentication, queues, SaaS integrations, or generic repositories until a real requirement supplies their invariants.

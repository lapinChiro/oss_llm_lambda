# AWS CDK infrastructure

This workspace deploys the template as two stacks:

- stateful: VPC, isolated Lambda/database subnets, RDS PostgreSQL 17, and an SSM-only bastion
- app: Backend and migration Lambdas, deployment migration trigger, HTTP API, private S3 site bucket, and CloudFront

CloudFront sends `/api/*` to API Gateway. Its default S3 behavior uses a viewer-request function to rewrite extensionless SPA routes to `/index.html`; API error responses are never rewritten.

## Configuration

All deployment-specific values are CDK context. Defaults synthesize without an AWS account, custom domain, or certificate.

| Context key | Default | Constraint / purpose |
| --- | --- | --- |
| `env` | `dev` | Environment name; `prod` enables RDS deletion protection/snapshots/seven-day backups and retains the site bucket |
| `appName` | `webapp` | Lowercase resource/name prefix |
| `databaseName` | `app` | PostgreSQL database name |
| `region` | `CDK_DEFAULT_REGION` or `us-east-1` | Deployment region |
| `ssmPrefix` | `/<appName>/<env>` | Prefix containing `DB_PASSWORD` |
| `domainName` | omitted | Optional CloudFront alias; must be supplied with `certificateArn` |
| `certificateArn` | omitted | ACM certificate ARN for `domainName` (CloudFront requires it in `us-east-1`) |

The AWS account is read only from `CDK_DEFAULT_ACCOUNT`; no account ID is committed. With no custom-domain inputs, CloudFront's generated domain is the frontend URL. Example custom mode:

```bash
npm run synth -w @app/infra -- \
  -c env=prod \
  -c appName=example \
  -c databaseName=example \
  -c ssmPrefix=/example/prod \
  -c domainName=app.example.com \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000
```

`domainName` and `certificateArn` are deliberately symmetric: supplying only one fails before synth.

## Secret and deployment sequence

Create the only required SSM secret before the first deployment. The optional shell variables must match any non-default CDK context:

```bash
APP_NAME=example SSM_PREFIX=/example/prod \
  ./infra/scripts/init-db-password.sh prod '<strong-password>' --profile my-profile

npm run deploy -w @app/infra -- \
  -c env=prod -c appName=example -c databaseName=example -c ssmPrefix=/example/prod
```

CloudFormation resolves the secure parameter into both Lambda configurations and RDS credentials. The source and synthesized template contain only the dynamic SSM reference, never the password value. The migration Lambda runs on stack creation and update before normal use.

The bastion scripts derive stack, database, and SSM names from `APP_NAME`, `DATABASE_NAME`, and `SSM_PREFIX`, using the same neutral defaults as CDK.

## Quality and topology checks

```bash
npm run type-check -w @app/infra
npm run lint -w @app/infra
npm run test -w @app/infra
npm run build -w @app/infra
npm run synth -w @app/infra
```

Tests cover typed context validation, default and custom-domain modes, neutral names, production safety settings, SPA fallback, API/Lambda/VPC/RDS/migration wiring, deterministic L1 snapshots, and PostgreSQL version currency. Update snapshots only after reviewing the CloudFormation structure:

```bash
npm exec -w @app/infra -- vitest run -u
```

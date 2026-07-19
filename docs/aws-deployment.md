# AWS deployment

CDK configuration is supplied with `-c key=value`; defaults are `env=dev`, `appName=webapp`, `databaseName=app`, region `us-east-1` (or `CDK_DEFAULT_REGION`), and SSM prefix `/<appName>/<env>`.

```bash
./infra/scripts/init-db-password.sh dev '<strong-password>'
npm run synth:dev -w @app/infra
npm run deploy:dev -w @app/infra
```

Set `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` through your AWS authentication environment. No account is committed. `prod` enables RDS deletion protection, snapshot retention, seven-day backups, and retains the site bucket; non-production favors disposable resources.

For a custom domain, supply both values (never only one):

```bash
npm run synth -w @app/infra -- \
  -c env=prod -c appName=example -c databaseName=example \
  -c ssmPrefix=/example/prod \
  -c domainName=app.example.com \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000
```

The CloudFront certificate must be in `us-east-1`. CD uses OIDC role secret `AWS_DEPLOY_ROLE_ARN`; set workflow `APP_NAME` and optional CDK context consistently when renaming. Bastion scripts accept `APP_NAME`, `DATABASE_NAME`, and `SSM_PREFIX` overrides matching CDK.

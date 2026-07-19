# Architecture

## Runtime flow

```text
Browser -> Vue view -> composable -> TodosApi
                                  -> Hono route/API -> service -> repository -> PostgreSQL
```

`packages/types` は HTTP wire contract だけを共有します。Frontend は repository や DB 型へ依存せず、Backend の repository は HTTP を知りません。Zod/OpenAPI が外部入力と応答を検証し、Kysely generated types と DB constraints が永続化境界を守ります。

## Production topology

```text
CloudFront -> private S3 (SPA)
          -> HTTP API -> Backend Lambda -> RDS PostgreSQL (isolated VPC)
                                      \-> Migration Lambda/custom resource
```

拡張子のない SPA path だけを CloudFront Function が `/index.html` へ書き換えます。`/api/*` のエラーは書き換えません。RDS と Lambda は SSM SecureString の DB password を参照し、値を source や synth output に保存しません。

## Change boundaries

ビジネス規則は service、query と永続化変換は repository、HTTP validation/serialization は schema と API、非同期 UI policy は composable に置きます。transaction は複数の永続化操作を一つの不変条件として扱う境界で開始します。

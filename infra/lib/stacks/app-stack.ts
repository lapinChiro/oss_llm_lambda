import type { DeploymentConfig } from '../config.js';
import type { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppStackProps extends cdk.StackProps {
  config: DeploymentConfig;
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  dbHost: string;
}

export class AppStack extends cdk.Stack {
  public readonly apiGatewayUrl: string;
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly distribution: cloudfront.Distribution;

  // eslint-disable-next-line max-lines-per-function
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // monorepo ルートへのパス: infra/lib/stacks/ → ../../../
    const monorepoRoot = path.join(__dirname, '..', '..', '..');
    const { config } = props;
    const prefix = config.resourcePrefix;

    // ===========================================================
    // Backend Lambda (VPC)
    // Hono API サーバー
    // ===========================================================
    const backendImageAsset = lambda.DockerImageCode.fromImageAsset(monorepoRoot, {
      file: 'apps/backend/Dockerfile',
      platform: ecr.Platform.LINUX_AMD64,
    });
    const backendSecurityGroup = new ec2.SecurityGroup(this, 'BackendSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: false,
      description: 'Backend Lambda egress to PostgreSQL only',
    });

    const backendLambda = new lambda.DockerImageFunction(this, 'BackendLambda', {
      functionName: `${prefix}-backend`,
      code: backendImageAsset,
      architecture: lambda.Architecture.X86_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: { subnetGroupName: 'Lambda' },
      securityGroups: [backendSecurityGroup],
      environment: {
        TZ: 'UTC',
        NODE_ENV: 'production',
        DB_HOST: props.dbHost,
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_NAME: config.databaseName,
        DB_PASSWORD: cdk.SecretValue.ssmSecure(`${config.ssmPrefix}/DB_PASSWORD`).unsafeUnwrap(),
        DB_SSL: 'true',
        DB_POOL_MAX: '3',
        DB_IDLE_TIMEOUT: '10000',
        DB_CONNECTION_TIMEOUT: '5000',
      },
      description: 'Backend API Lambda (Hono)',
    });

    // Backend Lambda → RDS アクセス許可
    backendLambda.connections.allowTo(props.dbSecurityGroup, ec2.Port.tcp(5432), 'Backend Lambda to RDS');

    // ===========================================================
    // Migration Lambda (VPC, 同じ Docker イメージ・CMD オーバーライド)
    // ===========================================================
    const migrationSecurityGroup = new ec2.SecurityGroup(this, 'MigrationSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: false,
      description: 'Migration Lambda egress to PostgreSQL only',
    });
    const migrationLambda = new lambda.DockerImageFunction(this, 'MigrationLambda', {
      functionName: `${prefix}-migration`,
      code: lambda.DockerImageCode.fromImageAsset(monorepoRoot, {
        file: 'apps/backend/Dockerfile',
        platform: ecr.Platform.LINUX_AMD64,
        cmd: ['dist/src/migrate-handler.handler'],
      }),
      architecture: lambda.Architecture.X86_64,
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetGroupName: 'Lambda' },
      securityGroups: [migrationSecurityGroup],
      environment: {
        TZ: 'UTC',
        NODE_ENV: 'production',
        DB_HOST: props.dbHost,
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_NAME: config.databaseName,
        DB_PASSWORD: cdk.SecretValue.ssmSecure(`${config.ssmPrefix}/DB_PASSWORD`).unsafeUnwrap(),
        DB_SSL: 'true',
        DB_POOL_MAX: '3',
        DB_IDLE_TIMEOUT: '10000',
        DB_CONNECTION_TIMEOUT: '5000',
      },
      description: 'Database migration Lambda',
    });

    // Migration Lambda → RDS アクセス許可
    migrationLambda.connections.allowTo(props.dbSecurityGroup, ec2.Port.tcp(5432), 'Migration Lambda to RDS');

    // ===========================================================
    // CDK Custom Resource: デプロイ時マイグレーション実行
    // ===========================================================
    new cr.AwsCustomResource(this, 'MigrationTrigger', {
      installLatestAwsSdk: false,
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: migrationLambda.functionName,
          Payload: JSON.stringify({ RequestType: 'Create' }),
        },
        physicalResourceId: cr.PhysicalResourceId.of('migration-trigger'),
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: migrationLambda.functionName,
          Payload: JSON.stringify({ RequestType: 'Update' }),
        },
        physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [migrationLambda.functionArn],
        }),
      ]),
    });

    // ===========================================================
    // API Gateway HTTP API v2
    // ===========================================================
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${prefix}-api`,
      description: `${config.appName} API Gateway (${config.environment})`,
    });

    // Backend Lambda Integration
    const backendIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'BackendIntegration',
      backendLambda,
    );

    // /api/{proxy+} → Backend Lambda
    this.httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: backendIntegration,
    });

    this.apiGatewayUrl = this.httpApi.url ?? '';

    // ===========================================================
    // S3 Bucket: Vue SPA 静的ファイル
    // ===========================================================
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `${prefix}-site-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.isProduction
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.isProduction,
      lifecycleRules: [
        {
          // 開きっぱなしタブの旧 SPA が古いハッシュチャンクを取得できる猶予期間を 7 日確保する。
          // 7 日後に自動削除し、ストレージ無限増加を防ぐ。
          // index.html / version.json / favicon.* は assets/ プレフィックス外のため本ルールの対象外
          // (これらは CD 工程で aws s3 cp により毎回上書きされる)。
          id: 'expire-old-hashed-assets',
          prefix: 'assets/',
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    // -------------------------------------------------------
    // API Gateway オリジン
    // -------------------------------------------------------
    const apiDomain = cdk.Fn.select(2, cdk.Fn.split('/', this.apiGatewayUrl));
    const apiOrigin = new cloudfrontOrigins.HttpOrigin(apiDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // -------------------------------------------------------
    // Optional ACM certificate. CloudFront's default domain is used when omitted.
    // -------------------------------------------------------
    const certificate = config.customDomain === undefined
      ? undefined
      : acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        config.customDomain.certificateArn,
      );

    // -------------------------------------------------------
    // SPA フォールバック用 CloudFront Function (defaultBehavior にのみ attach)
    //
    // 拡張子なしのパス (`/`, `/projects/123` 等) を `/index.html` に書換え、S3 が
    // 常に存在する object を返す状態にして missing object error を未然に防ぐ。
    //
    // distribution-level の `errorResponses` を使わない理由:
    //   `errorResponses` は distribution 全体に適用されるため、`/api/*` cache
    //   behavior の応答 (backend が返す 403/404 JSON) まで `/index.html` (200)
    //   へ書き換えられてしまい、frontend が JSON パースに失敗する。
    //   viewer-request の Function で書き換えれば S3 origin にしか作用せず、
    //   API origin の応答ステータスはそのまま frontend に届く。
    //
    // ⚠️ 要同期: 判定ロジックの正は infra/lib/cloudfront/spa-fallback.ts (resolveSpaFallbackUri)。
    //    JS_2_0 は import 不可のため下記 inline は同モジュールの写経であり、変更時は両方を更新し
    //    ユニットテストで検証すること。
    // -------------------------------------------------------
    const spaFallbackFunction = new cloudfront.Function(this, 'SpaFallbackFunction', {
      functionName: `${prefix}-spa-fallback`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  // 拡張子付き (例: .js, .css, .html, .svg, .png, .ico) はそのまま S3 へ。
  // 拡張子なしは SPA クライアントルートとみなして /index.html へ書換える。
  if (uri.match(/\\.[a-zA-Z0-9]+$/)) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}
`),
    });

    // -------------------------------------------------------
    // CloudFront Distribution
    // -------------------------------------------------------
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${prefix}-cdn`,
      ...(config.customDomain === undefined
        ? {}
        : { domainNames: [config.customDomain.domainName], certificate }),
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaFallbackFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      // errorResponses は意図的に設定しない。
      // SPA フォールバックは spaFallbackFunction で行うため、S3 が 403/404 を返す経路は発生しない。
      // distribution-level の errorResponses は /api/* にも波及するため設定しない。
    });

    backendLambda.addEnvironment(
      'FRONTEND_URL',
      config.customDomain === undefined
        ? `https://${this.distribution.distributionDomainName}`
        : `https://${config.customDomain.domainName}`,
    );

    // --- Outputs ---
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGatewayUrl,
    });
    new cdk.CfnOutput(this, 'BackendLambdaArn', {
      value: backendLambda.functionArn,
    });
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
    });
    if (config.customDomain !== undefined) {
      new cdk.CfnOutput(this, 'CustomDomainName', {
        value: config.customDomain.domainName,
      });
    }
  }
}

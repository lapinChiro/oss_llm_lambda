import type { App } from 'aws-cdk-lib'

export interface CustomDomainConfig {
  certificateArn: string
  domainName: string
}

export interface DeploymentConfig {
  appName: string
  customDomain?: CustomDomainConfig
  databaseName: string
  environment: string
  isProduction: boolean
  region: string
  resourcePrefix: string
  ssmPrefix: string
}

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
const ENVIRONMENT_PATTERN = /^[a-z][a-z0-9-]{0,15}$/
const DATABASE_PATTERN = /^[a-z][a-z0-9_]{0,62}$/
const CERTIFICATE_ARN_PATTERN = /^arn:[^:]+:acm:[^:]+:[0-9]{12}:certificate\/[0-9a-f-]+$/

function optionalContext(app: App, key: string): string | undefined {
  const value: unknown = app.node.tryGetContext(key)
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`CDK context "${key}" must be a string`)
  return value
}

function valid(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) throw new Error(`Invalid ${label}: ${value}`)
  return value
}

export function loadDeploymentConfig(app: App): DeploymentConfig {
  const appName = valid(optionalContext(app, 'appName') ?? 'webapp', NAME_PATTERN, 'appName')
  const environment = valid(optionalContext(app, 'env') ?? 'dev', ENVIRONMENT_PATTERN, 'env')
  const databaseName = valid(optionalContext(app, 'databaseName') ?? 'app', DATABASE_PATTERN, 'databaseName')
  const region = optionalContext(app, 'region') ?? process.env.CDK_DEFAULT_REGION ?? 'us-east-1'
  const ssmPrefix = optionalContext(app, 'ssmPrefix') ?? `/${appName}/${environment}`
  if (!ssmPrefix.startsWith('/') || ssmPrefix.endsWith('/')) {
    throw new Error('ssmPrefix must start with "/" and must not end with "/"')
  }

  const domainName = optionalContext(app, 'domainName')
  const certificateArn = optionalContext(app, 'certificateArn')
  if ((domainName === undefined) !== (certificateArn === undefined)) {
    throw new Error('domainName and certificateArn must be configured together')
  }
  if (certificateArn !== undefined && !CERTIFICATE_ARN_PATTERN.test(certificateArn)) {
    throw new Error(`Invalid certificateArn: ${certificateArn}`)
  }

  return {
    appName,
    databaseName,
    environment,
    isProduction: environment === 'prod',
    region,
    resourcePrefix: `${appName}-${environment}`,
    ssmPrefix,
    ...(domainName !== undefined && certificateArn !== undefined
      ? { customDomain: { certificateArn, domainName } }
      : {}),
  }
}

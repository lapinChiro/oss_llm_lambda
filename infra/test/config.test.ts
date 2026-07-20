import * as cdk from 'aws-cdk-lib'
import { describe, expect, it } from 'vitest'

import { loadDeploymentConfig } from '../lib/config.js'

describe('loadDeploymentConfig', () => {
  it('account-independent neutral defaultsを返す', () => {
    expect(loadDeploymentConfig(new cdk.App())).toEqual({
      appName: 'webapp',
      databaseName: 'app',
      environment: 'dev',
      isProduction: false,
      region: 'us-east-1',
      resourcePrefix: 'webapp-dev',
      ssmPrefix: '/webapp/dev',
    })
  })

  it('resource、database、SSM、custom domain入力を一つのtyped configへ正規化する', () => {
    const app = new cdk.App({ context: {
      appName: 'example',
      certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/11111111-2222-3333-4444-555555555555',
      databaseName: 'example_db',
      domainName: 'app.example.com',
      env: 'prod',
      region: 'ap-northeast-1',
      ssmPrefix: '/company/example/prod',
    } })

    expect(loadDeploymentConfig(app)).toMatchObject({
      appName: 'example',
      customDomain: { domainName: 'app.example.com' },
      databaseName: 'example_db',
      isProduction: true,
      resourcePrefix: 'example-prod',
      ssmPrefix: '/company/example/prod',
    })
  })

  it.each([
    [{ domainName: 'app.example.com' }, 'domainName and certificateArn'],
    [{ certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/11111111-2222-3333-4444-555555555555' }, 'domainName and certificateArn'],
    [{ appName: 'Old_Product' }, 'Invalid appName'],
    [{ ssmPrefix: 'missing-leading-slash' }, 'ssmPrefix'],
  ])('不完全または不正なcontext %jを拒否する', (context, message) => {
    expect(() => loadDeploymentConfig(new cdk.App({ context }))).toThrow(message)
  })
})

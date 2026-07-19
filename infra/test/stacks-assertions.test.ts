import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'

import { synthStacks } from './template-snapshot.js'

const CUSTOM_DOMAIN = {
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/11111111-2222-3333-4444-555555555555',
  domainName: 'app.example.com',
}

describe('generalized infrastructure topology', () => {
  it('default mode keeps SPA, API, Lambda, migration, VPC, and RDS without a custom domain', () => {
    const stacks = synthStacks()
    const stateful = Template.fromJSON(stacks.stateful as never)
    const app = Template.fromJSON(stacks.app as never)

    stateful.resourceCountIs('AWS::EC2::VPC', 1)
    stateful.resourceCountIs('AWS::RDS::DBInstance', 1)
    stateful.resourceCountIs('AWS::EC2::VPCEndpoint', 0)
    stateful.hasResourceProperties('AWS::RDS::DBInstance', {
      BackupRetentionPeriod: 7,
      DBName: 'app',
      DeletionProtection: true,
      MasterUserPassword: '{{resolve:ssm-secure:/webapp/prod/DB_PASSWORD}}',
    })
    app.resourceCountIs('AWS::S3::Bucket', 1)
    app.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    })
    app.resourceCountIs('AWS::ApiGatewayV2::Api', 1)
    app.resourceCountIs('AWS::Lambda::Function', 3)
    app.hasResourceProperties('AWS::Lambda::Function', { FunctionName: 'webapp-prod-backend' })
    app.hasResourceProperties('AWS::Lambda::Function', { FunctionName: 'webapp-prod-migration' })
    app.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'ANY /api/{proxy+}' })
    app.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: { Runtime: 'cloudfront-js-2.0' },
      FunctionCode: Match.stringLikeRegexp("request.uri = '/index.html'"),
    })
    app.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: Match.absent(), DefaultRootObject: 'index.html' }),
    })

    const serialized = JSON.stringify(stacks)
    expect(serialized).not.toMatch(/internal\/\{proxy\+\}|INTERNAL_API_KEY|EventBridge|ProxyLambda/iu)
  })

  it('custom-domain mode adds the alias and ACM certificate only when both values are supplied', () => {
    const app = Template.fromJSON(synthStacks({ customDomain: CUSTOM_DOMAIN }).app as never)
    app.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['app.example.com'],
        ViewerCertificate: Match.objectLike({ AcmCertificateArn: CUSTOM_DOMAIN.certificateArn }),
      }),
    })
    app.hasOutput('CustomDomainName', { Value: CUSTOM_DOMAIN.domainName })
  })
})

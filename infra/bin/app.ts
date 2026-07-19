#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { loadDeploymentConfig } from '../lib/config.js';
import { AppStack } from '../lib/stacks/app-stack.js';
import { StatefulStack } from '../lib/stacks/stateful-stack.js';

const app = new cdk.App();
const config = loadDeploymentConfig(app);

const stackProps: cdk.StackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
  },
};

// --- スタック依存関係 (2スタック構成) ---
// StatefulStack (VPC + RDS)
//   └── AppStack (Backend/Migration Lambda + API Gateway + S3 + CloudFront)

const stateful = new StatefulStack(app, `${config.resourcePrefix}-stateful`, {
  ...stackProps,
  config,
});

new AppStack(app, `${config.resourcePrefix}-app`, {
  ...stackProps,
  config,
  vpc: stateful.vpc,
  dbSecurityGroup: stateful.dbSecurityGroup,
  dbHost: stateful.dbInstance.dbInstanceEndpointAddress,
});

app.synth();

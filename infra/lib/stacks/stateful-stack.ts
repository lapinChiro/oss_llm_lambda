import type { DeploymentConfig } from '../config.js';
import type { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';

interface StatefulStackProps extends cdk.StackProps {
  config: DeploymentConfig;
}

export class StatefulStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: StatefulStackProps) {
    super(scope, id, props);

    const { config } = props;
    const prefix = config.resourcePrefix;

    // -------------------------------------------------------
    // VPC: NAT Gateway なし、Internet Gateway なし
    // -------------------------------------------------------
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${prefix}-vpc`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Lambda',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // -------------------------------------------------------
    // Security Group: RDS 用
    // Backend Lambda / Migration Lambda からの 5432 ポートのみ許可
    // (Ingress は AppStack で追加する)
    // -------------------------------------------------------
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${prefix}-db-sg`,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // -------------------------------------------------------
    // RDS PostgreSQL 17
    // -------------------------------------------------------
    this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `${prefix}-rds`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17,
      }),
      credentials: rds.Credentials.fromUsername('postgres', {
        password: cdk.SecretValue.ssmSecure(`${config.ssmPrefix}/DB_PASSWORD`),
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc: this.vpc,
      vpcSubnets: { subnetGroupName: 'Database' },
      securityGroups: [this.dbSecurityGroup],
      databaseName: config.databaseName,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      removalPolicy: config.isProduction
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,
      deletionProtection: config.isProduction,
      backupRetention: cdk.Duration.days(config.isProduction ? 7 : 1),
    });

    // -------------------------------------------------------
    // Bastion Security Group: SSM port forwarding 用
    // inbound 0 件 / outbound は RDS:5432 + 0.0.0.0/0:443 (SSM agent)
    // -------------------------------------------------------
    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${prefix}-bastion-sg`,
      description: 'Bastion EC2 (SSM only, no ingress)',
      allowAllOutbound: false,
    });
    bastionSecurityGroup.addEgressRule(
      this.dbSecurityGroup,
      ec2.Port.tcp(5432),
      'Bastion to RDS',
    );
    bastionSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'SSM agent to AWS API',
    );

    this.dbSecurityGroup.addIngressRule(
      bastionSecurityGroup,
      ec2.Port.tcp(5432),
      'RDS from Bastion',
    );

    // -------------------------------------------------------
    // Bastion EC2
    // t4g.nano / AL2023 ARM / public subnet 1AZ / SSM のみ
    // -------------------------------------------------------
    const bastionRole = new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const bastion = new ec2.Instance(this, 'BastionInstance', {
      instanceName: `${prefix}-bastion`,
      vpc: this.vpc,
      vpcSubnets: { subnets: [this.vpc.publicSubnets[0]] },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: bastionSecurityGroup,
      role: bastionRole,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      associatePublicIpAddress: true,
    });

    // -------------------------------------------------------
    // SSM Parameter Store: パラメータパスプレフィックス
    // パラメータは put-parameters.sh で手動作成する (SecureString)
    // -------------------------------------------------------
    this.ssmPrefix = config.ssmPrefix;

    // --- Outputs ---
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'SsmPrefix', {
      value: this.ssmPrefix,
    });
    new cdk.CfnOutput(this, 'BastionInstanceId', {
      value: bastion.instanceId,
    });
  }
}

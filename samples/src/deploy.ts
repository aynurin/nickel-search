
import AWSSDK from "aws-sdk";
import commander from "commander";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import AWSAPI from "./aws";
import Docker from "./docker";

const fsAsync = {
    readFile: promisify(fs.readFile),
    writeFile: promisify(fs.writeFile),
};

commander
    .option("--aws-profile <awsProfile>", "AWS CLI profile name")
    .option("--aws-region <awsRegion>", "AWS region")
    .option("--stack-name <stackName>", "Your preferred AWS stack name")
    .option("--step <stepname>", "Your preferred AWS stack name")
    .option("--source <source>", "Your preferred AWS stack name")
    .option("--index <index>", "Your preferred AWS stack name")
    .parse(process.argv);

const docker = new Docker();
const AWS = new AWSAPI(commander.awsProfile, commander.awsRegion);

const fargateTagName = "nickel-fargate-indexer";

const steps: { [name: string]: () => Promise<void>; } = { };

steps.aws = async () => {
    const cfTemplate = await fsAsync.readFile(
        relpath("../aws/AWSStack.CF.yaml"));

    const stackInfo = await AWS.ensureStack(cfTemplate.toString(), commander.stackName);
    const output = getStackOutput(stackInfo);
    await generateDataParams(output.sourceBucket, output.targetBucket);
    await AWS.syncS3("./samples/data/source/", `s3://${output.sourceBucket}/`);
    await docker.build("./samples/docker/Dockerfile", fargateTagName);
    const credentials = await AWS.getDockerCredentialsForRegistryTag(output.repository, fargateTagName);
    await docker.login(credentials.username, credentials.password, credentials.endpoint);
    await docker.tag(fargateTagName, credentials.fullname);
    await docker.push(credentials.fullname);

    console.log("");
    console.log("======================================");
    console.log("To start the indexer:");
    console.log(`aws --profile=${commander.awsProfile} --region=${commander.awsRegion} ` +
                    `ecs run-task --cluster=${output.clusterName} --task-definition=${output.taskDefinition} ` +
                    `"--network-configuration=awsvpcConfiguration={` +
                        `subnets=[${output.subnetA},${output.subnetB}],` +
                        `securityGroups=[${output.securityGroup}],assignPublicIp=ENABLED}" --launch-type=FARGATE`);
    console.log("");
    console.log("To run search:");
    console.log(`npm run samples:search -- --index=s3://${output.targetBucket}/ ` +
                    `--aws-profile=${commander.awsProfile}`);
    console.log("======================================");
    console.log("");
};

steps.docker = async () => {
    const stackInfo = await AWS.describeStack(commander.stackName);
    const output = getStackOutput(stackInfo);
    await generateDataParams(commander.source, commander.index);
    await docker.build("./samples/docker/Dockerfile", fargateTagName);
    const credentials = await AWS.getDockerCredentialsForRegistryTag(output.repository, fargateTagName);
    await docker.login(credentials.username, credentials.password, credentials.endpoint);
    await docker.tag(fargateTagName, credentials.fullname);
    await docker.push(credentials.fullname);

    console.log("");
    console.log("======================================");
    console.log("To start the indexer:");
    console.log(`aws --profile=${commander.awsProfile} --region=${commander.awsRegion} ` +
                    `ecs run-task --cluster=${output.clusterName} --task-definition=${output.taskDefinition} ` +
                    `"--network-configuration=awsvpcConfiguration={` +
                        `subnets=[${output.subnetA},${output.subnetB}],` +
                        `securityGroups=[${output.securityGroup}],assignPublicIp=ENABLED}" --launch-type=FARGATE`);
    console.log("");
    console.log("To run search:");
    console.log(`npm run samples:search -- --index=s3://${output.targetBucket}/ ` +
                    `--aws-profile=${commander.awsProfile}`);
    console.log("======================================");
    console.log("");
};

async function generateDataParams(sourceBucket: string, targetBucket: string) {
    console.log("Generating indexing configuration...");
    await fsAsync.writeFile(relpath("./source.js"),
        "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        `exports.default = { location: "s3://${sourceBucket}/" };`);
    await fsAsync.writeFile(relpath("./target.js"),
        "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        `exports.default = { location: "s3://${targetBucket}/" };`);
}

function getStackOutput(stackInfo: AWSSDK.CloudFormation.Stack) {
    const outputs = {
        clusterName: outputValueOrNull(stackInfo, "Cluster"),
        repository: outputValueOrNull(stackInfo, "ClusterRepository"),
        taskDefinition: outputValueOrNull(stackInfo, "IndexerTaskDefinition"),

        sourceBucket: outputValueOrNull(stackInfo, "DataSourceS3Bucket"),
        targetBucket: outputValueOrNull(stackInfo, "IndexS3BucketA"),

        securityGroup: outputValueOrNull(stackInfo, "SecurityGroup"),
        subnetA: outputValueOrNull(stackInfo, "SubnetA"),
        subnetB: outputValueOrNull(stackInfo, "SubnetB"),
    };

    if (!outputs.clusterName) {
        throw Error(`Cluster name was not found in the output: ${stackInfo}`);
    }
    if (!outputs.repository) {
        throw Error(`Repository name was not found in the output: ${stackInfo}`);
    } else {
        outputs.repository = outputs.repository.split("/")[1];
    }
    if (!outputs.taskDefinition) {
        throw Error(`Task definition ARN name was not found in the output: ${stackInfo}`);
    } else {
        const arnParts = outputs.taskDefinition.split(":");
        outputs.taskDefinition = arnParts[arnParts.length - 2].split("/")[1];
    }

    if (!outputs.sourceBucket) {
        throw Error(`Source bucket was not found in the output: ${stackInfo}`);
    }
    if (!outputs.targetBucket) {
        throw Error(`Target bucket was not found in the output: ${stackInfo}`);
    }

    if (!outputs.securityGroup) {
        throw Error(`Security group was not found in the output: ${stackInfo}`);
    }
    if (!outputs.subnetA) {
        throw Error(`Subnet A was not found in the output: ${stackInfo}`);
    }
    if (!outputs.subnetB) {
        throw Error(`Subnet B was not found in the output: ${stackInfo}`);
    }

    return outputs;
}

function outputValueOrNull(stack: AWS.CloudFormation.Stack, key: string): string | undefined {
    if (!stack.Outputs) {
        throw Error(`Stack outputs not defined: ${stack}`);
    }
    const param = stack.Outputs.find((item) => item.OutputKey === key);
    if (param) {
        return param.OutputValue;
    }
}

function relpath(relToThisFile: string): string {
    return path.join(
        path.relative(process.cwd(), path.dirname(__filename)),
        relToThisFile);
}

if (commander.step in steps) {
    steps[commander.step]();
} else {
    console.log("Could not identify step to execute");
}

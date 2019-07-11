
import AWS from "aws-sdk";
import child_process from "child_process";
import commander from "commander";
import fs from "fs";
import path from "path";
import { promisify } from "util";

commander
    .option("--aws-profile <awsProfile>", "AWS CLI profile name")
    .option("--aws-region <awsRegion>", "AWS region")
    .option("--stack-name <stackName>", "Your preferred AWS stack name")
    .parse(process.argv);

const awsConfig = new AWS.Config({
    credentials: new AWS.SharedIniFileCredentials({ profile: commander.awsProfile }),
    region: commander.awsRegion,
});

const cloudFormation = new AWS.CloudFormation(awsConfig);
const ecr = new AWS.ECR(awsConfig);

const fsAsync = {
    readFile: promisify(fs.readFile),
    writeFile: promisify(fs.writeFile),
};

const exec = promisify(child_process.exec);

const fargateTagName = "nickel-fargate-indexer";

async function ensureStack(stackName: string): Promise<AWS.CloudFormation.Types.DescribeStacksOutput> {
    const stackInfo = await describeStack(stackName);
    const cfTemplate = await fsAsync.readFile(
        path.join(path.dirname(__filename), "../../samples/aws/AWSStack.CF.yaml"));
    const stackParams: AWS.CloudFormation.Types.CreateStackInput = {
        StackName: stackName,           /* required */
        Capabilities: [
            "CAPABILITY_AUTO_EXPAND",
            "CAPABILITY_IAM",
            "CAPABILITY_NAMED_IAM",
        ],
        Parameters: [],
        Tags: [{
            Key: "Product",         /* required */
            Value: "NickelSearch",  /* required */
        }, {
            Key: "StackName",       /* required */
            Value: stackName,       /* required */
        },
        ],
        TemplateBody: cfTemplate.toString(),
    };
    if (stackInfo) {
        console.log(`Updating stack ${stackName}...`);
        await cloudFormation.updateStack({
            ...stackParams,
            UsePreviousTemplate: false,
        }).promise();
        await cloudFormation.waitFor("stackUpdateComplete", { StackName: stackName }).promise();
    } else {
        console.log(`Creating stack ${stackName}...`);
        await cloudFormation.createStack({
            ...stackParams,
            OnFailure: "ROLLBACK",
            TimeoutInMinutes: 30,
        }).promise();
        await cloudFormation.waitFor("stackCreateComplete", { StackName: stackName }).promise();
    }
    console.log(`Done`);
    return await cloudFormation.describeStacks({ StackName: stackName }).promise();
}

async function describeStack(stackName: string): Promise<AWS.CloudFormation.DescribeStacksOutput | null> {
    try {
        return await cloudFormation.describeStacks({ StackName: stackName }).promise();
    } catch (err) {
        if (err.code === "ValidationError" && err.message === `Stack with id ${stackName} does not exist`) {
            return null;
        } else {
            throw err;
        }
    }
}

function validateStackOutput(stackOutput: AWS.CloudFormation.Types.DescribeStacksOutput, stackName: string) {
    if (!stackOutput || !Array.isArray(stackOutput.Stacks) || stackOutput.Stacks.length === 0) {
        throw Error(`Unexpected result recieved from cloudFormation.describeStacks: ${JSON.stringify(stackOutput)}`);
    }
    const thisStackInfo = stackOutput.Stacks.find((stack) => stack.StackName === stackName);
    if (!thisStackInfo) {
        throw Error(`Didn't find the expected stack info in ${JSON.stringify(stackOutput)}`);
    }
    return thisStackInfo;
}

async function generateDataParams(sourceBucket: string, targetBucket: string, awsProfile: string) {
    console.log("Generating indexing configuration...");
    await fsAsync.writeFile(path.join(path.dirname(__filename), "../../dist/source.js"),
        "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        `exports.default = { location: "s3://${sourceBucket}/" };`);
    await fsAsync.writeFile(path.join(path.dirname(__filename), "../../dist/target.js"),
        "Object.defineProperty(exports, \"__esModule\", { value: true });\n" +
        `exports.default = { location: "s3://${targetBucket}/", prefixes: 1000 };`);
}

async function uploadSampleData(sourceBucket: string) {
    console.log("Uploading sample data...");
    let cmd = "aws";
    if (process.platform === "win32") {
        cmd = "aws.cmd";
    }
    await spawn(cmd, [
        "--profile=" + commander.awsProfile,
        "--region=" + commander.awsRegion,
        "s3",
        "sync",
        "../../data/source/",
        `s3://${sourceBucket}/`]);
}

async function dockerBuild(): Promise<void> {
    // docker build . -f /docker/fargate/Dockerfile
    console.log("Building docker image...");
    await spawn("docker", [
        "build",
        "../..",
        "--file",
        "../../docker/fargate/Dockerfile",
        "--tag=" + fargateTagName]);
}

async function dockerPublish(ecrname: string): Promise<void> {
    const dockerAuth = await ecr.getAuthorizationToken({}).promise();
    if (dockerAuth.authorizationData) {
        const authData = dockerAuth.authorizationData[0];
        if (authData.authorizationToken && authData.proxyEndpoint) {
            const creds = Buffer.from(authData.authorizationToken, "base64").toString().split(":");
            const fullname = `${authData.proxyEndpoint.replace("https://", "")}/${ecrname}:${fargateTagName}`;
            console.log("Docker login...");
            await spawn("docker", [
                "login",
                "-u", creds[0],
                "-p", creds[1],
                authData.proxyEndpoint]);
            console.log("Docker tag...");
            await spawn("docker", [
                "tag",
                fargateTagName,
                fullname]);
            console.log("Docker push...");
            await spawn("docker", [
                "push",
                fullname]);
        }
    }
}

async function spawn(command: string, args: string[],
                     options?: child_process.SpawnOptions): Promise<number> {
    console.debug(command, args.join(" "));
    return new Promise((resolve, reject) => {
        options = Object.assign({
            cwd: path.dirname(__filename),
            shell: true,
            stdio: "inherit",
        }, options);
        const subproc = child_process.spawn(command, args, options);
        subproc.on("error", (err) => {
            reject(err);
        });
        subproc.on("close", (code: number) => {
            resolve(code);
        });
    });
}

function memberOrDefault<T>(obj: any, membername: string, defaultValue?: T | undefined): T | undefined {
    if (obj) {
        return obj[membername];
    } else {
        return defaultValue;
    }
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

ensureStack(commander.stackName).then(async (stackOutput: AWS.CloudFormation.Types.DescribeStacksOutput) => {
    const thisStack = validateStackOutput(stackOutput, commander.stackName);

    const outputs = {
        clusterName: outputValueOrNull(thisStack, "Cluster"),
        repository: outputValueOrNull(thisStack, "ClusterRepository"),
        taskDefinition: outputValueOrNull(thisStack, "IndexerTaskDefinition"),

        sourceBucket: outputValueOrNull(thisStack, "DataSourceS3Bucket"),
        targetBucket: outputValueOrNull(thisStack, "IndexS3BucketA"),

        securityGroup: outputValueOrNull(thisStack, "SecurityGroup"),
        subnetA: outputValueOrNull(thisStack, "SubnetA"),
        subnetB: outputValueOrNull(thisStack, "SubnetB"),
    };

    if (!outputs.clusterName) {
        throw Error(`Cluster name was not found in the output: ${thisStack}`);
    }
    if (!outputs.repository) {
        throw Error(`Repository name was not found in the output: ${thisStack}`);
    } else {
        outputs.repository = outputs.repository.split("/")[1];
    }
    if (!outputs.taskDefinition) {
        throw Error(`Task definition ARN name was not found in the output: ${thisStack}`);
    } else {
        const arnParts = outputs.taskDefinition.split(":");
        outputs.taskDefinition = arnParts[arnParts.length - 2].split("/")[1];
    }

    if (!outputs.sourceBucket) {
        throw Error(`Source bucket was not found in the output: ${thisStack}`);
    }
    if (!outputs.targetBucket) {
        throw Error(`Target bucket was not found in the output: ${thisStack}`);
    }

    if (!outputs.securityGroup) {
        throw Error(`Security group was not found in the output: ${thisStack}`);
    }
    if (!outputs.subnetA) {
        throw Error(`Subnet A was not found in the output: ${thisStack}`);
    }
    if (!outputs.subnetB) {
        throw Error(`Subnet B was not found in the output: ${thisStack}`);
    }

    await generateDataParams(outputs.sourceBucket, outputs.targetBucket, commander.awsProfile);
    await uploadSampleData(outputs.sourceBucket);
    await dockerBuild();
    await dockerPublish(outputs.repository);

    console.log("Run the indexer task manually:");
    console.log(`aws --profile=${commander.awsProfile} --region=${commander.awsRegion} ` +
                    `ecs run-task --cluster=${outputs.clusterName} --task-definition=${outputs.taskDefinition} ` +
                    `"--network-configuration=awsvpcConfiguration={` +
                        `subnets=[${outputs.subnetA},${outputs.subnetB}],` +
                        `securityGroups=[${outputs.securityGroup}],assignPublicIp=ENABLED}" --launch-type=FARGATE`);
});

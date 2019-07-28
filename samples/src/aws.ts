
import AWS from "aws-sdk";
import spawn from "./spawn";

export default class AWSAPI {
    private profile: string;
    private region: string;

    private awsConfig: AWS.Config;
    private cloudFormation: AWS.CloudFormation;
    private ecr: AWS.ECR;

    constructor(profile: string, region: string) {
        this.profile = profile;
        this.region = region;

        this.awsConfig = new AWS.Config({
            credentials: new AWS.SharedIniFileCredentials({ profile }),
            region,
        });
        this.cloudFormation = new AWS.CloudFormation(this.awsConfig);
        this.ecr = new AWS.ECR(this.awsConfig);
    }

    public async ensureStack(cfTemplate: string, stackName: string):
                             Promise<AWS.CloudFormation.Stack> {
        const stackInfo = await this.describeStack(stackName);
        const stackParams: AWS.CloudFormation.Types.CreateStackInput = {
            StackName: stackName,           /* required */
            Capabilities: [
                "CAPABILITY_AUTO_EXPAND",
                "CAPABILITY_IAM",
                "CAPABILITY_NAMED_IAM",
            ],
            Parameters: [],
            Tags: [{
                Key: "Product",             /* required */
                Value: "NickelSearch",      /* required */
            }, {
                Key: "StackName",           /* required */
                Value: stackName,           /* required */
            }],
            TemplateBody: cfTemplate.toString(),
        };
        if (stackInfo) {
            console.log(`Updating stack ${stackName}...`);
            await this.cloudFormation.updateStack({
                ...stackParams,
                UsePreviousTemplate: false,
            }).promise();
            await this.cloudFormation.waitFor("stackUpdateComplete", { StackName: stackName }).promise();
        } else {
            console.log(`Creating stack ${stackName}...`);
            await this.cloudFormation.createStack({
                ...stackParams,
                OnFailure: "ROLLBACK",
                TimeoutInMinutes: 30,
            }).promise();
            await this.cloudFormation.waitFor("stackCreateComplete", { StackName: stackName }).promise();
        }
        console.log(`Done`);
        return await this.describeStack(stackName);
    }

    public async describeStack(stackName: string): Promise<AWS.CloudFormation.Stack | null> {
        try {
            const stackOutput = await this.cloudFormation.describeStacks({ StackName: stackName }).promise();
            if (!stackOutput || !Array.isArray(stackOutput.Stacks) || stackOutput.Stacks.length === 0) {
                throw Error("Unexpected result recieved from cloudFormation.describeStacks: " +
                            JSON.stringify(stackOutput));
            }
            const thisStackInfo = stackOutput.Stacks.find((stack) => stack.StackName === stackName);
            if (!thisStackInfo) {
                throw Error(`Didn't find the expected stack info in ${JSON.stringify(stackOutput)}`);
            }
            return thisStackInfo;
        } catch (err) {
            if (err.code === "ValidationError" && err.message === `Stack with id ${stackName} does not exist`) {
                return null;
            } else {
                throw err;
            }
        }
    }

    public async syncS3(source: string, target: string) {
        console.log("Uploading sample data...");
        let cmd = "aws";
        if (process.platform === "win32") {
            cmd = "aws.cmd";
        }
        await spawn(cmd, [
            "--profile=" + this.profile,
            "--region=" + this.region,
            "s3", "sync", source, target]);
    }

    public async getDockerCredentialsForRegistryTag(registryName: string, tagName: string) {
        const dockerAuth = await this.ecr.getAuthorizationToken({}).promise();
        if (dockerAuth.authorizationData) {
            const authData = dockerAuth.authorizationData[0];
            if (authData.authorizationToken && authData.proxyEndpoint) {
                const creds = Buffer.from(authData.authorizationToken, "base64").toString().split(":");
                const fullname = `${authData.proxyEndpoint.replace("https://", "")}/${registryName}:${tagName}`;
                return {
                    endpoint: authData.proxyEndpoint,
                    fullname,
                    password: creds[1],
                    username: creds[0],
                };
            }
        }
        return null;
    }
}

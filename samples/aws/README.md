# AWS Stack example

This example creates an AWS deployment depicted on the following diagram and runs indexing on the sample dataset:

This example will do the following:

1. Create an AWS Stack depicted above in your AWS account
2. Get the stack objects parameters to configure Nickel Indexer
3. Upload sample documents to the created S3 data source bucket
4. Generate the indexer code and a Dockerfile
5. Publish the Docker image to the created AWS ECS Docker Repository
6. Start indexing
7. Demonstrate searching capabilities

So let's get going.

## Prerequisites

In order to run this example, you need to have:

1. AWS CLI installed and cofigured with a named [AWS CLI profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
2. Nodejs 10.x installed.
3. This repository cloned on your machine.

## Running the example

CD into the directory where this repository is cloned and run:

```bash
$> npm install
$> npm run deployaws --aws-profile=YOUR_AWS_CLI_PROFILE_NAME --aws-region=YOUR_PREFERRED_REGION_NAME
```

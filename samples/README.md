# Nickel Search Samples

This folder contains examples of using the library.

## TODO

1. Remove the CF stack retaining S3 buckets. Or take the S3 buckets out of the cloudformation.

## Local index

To start playing with Nickel, you can run this example locally. Just clone this repo, create an index directory, and run it. Take a look at the example source dataset that conains [about 2000 book names](../data/source) extracted from the 2019-04-30 [Open Library](https://openlibrary.org/) [dump](https://openlibrary.org/developers/dumps).

The following commands convert the source documents into a searchable index:

```bash
$> git clone git@github.com:aynurin/nickel-search.git
$> cd ./nickel-search
$> npm install
$> mkdir ./samples/data/index
$> npm run samples:index -- --data=./samples/data/source --index=./samples/data/index
$> npm run samples:search -- --index=./samples/data/index
```

## Run on AWS

Nickel is created to take advantage of AWS S3 for the index storage. In addition to that, in this example we will also run the indexer on AWS.

This example implements the following steps:

1. Creating the following AWS infrastructure:
    ![AWS Infrastructure](./docs/template1-designer.png)
2. Filling the Data Source with example data
3. Deploying the Indexer Docker container to the ECS Docker Registry
4. Running the Docker container to start indexing.

All but last steps are automated in the following command:

```bash
npm run samples:deploy -- --aws-profile=<aws_cli_profile_name> --aws-region=<aws_region_name> --step=aws --stack-name=<your_preferred_cloudformaion_stack_name>
```

The command runs the first three steps. Note the last block that command outputs. In that block you will find:

- a command to run the last step - the indexer, which is the AWS Fargate task that runs the created Docker container
- and a command to run the search when the indexer has completed indexing. You can monitor indexing in AWS CloudWatch logs.

### Run on AWS with your own data

The proper way of using Nickel is by implementing your own solution as described in the [main README.md](../README.md). But if you want to see a quick and dirty example with your own data, you can follow the next steps:

1. Update the [./samples/model.ts](model.ts) implementation to match your needs
2. Update IAM indexer role (named something like `STACK_NAME-IndexerRole-ID`) and S3 bucket policies to access for indexing:
    - Update source S3 bucket policy to let indexer read data from it by adding the following statements:

        ```json
        {
            "Version": "2008-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "INDEXER_ROLE_ARN"
                    },
                    "Action": "s3:ListBucket",
                    "Resource": "SOURCE_S3_BUCKET_ARN"
                },
                {
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "INDEXER_ROLE_ARN"
                    },
                    "Action": "s3:GetObject",
                    "Resource": "SOURCE_S3_BUCKET_ARN/*"
                }
            ]
        }
        ```

    - Update index S3 bucket policy to include the following statements:

        ```json
        {
            "Version": "2008-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "INDEXER_ROLE_ARN"
                    },
                    "Action": "s3:ListBucket",
                    "Resource": "INDEX_S3_BUCKET_ARN"
                },
                {
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "INDEXER_ROLE_ARN"
                    },
                    "Action": [
                        "s3:GetObject",
                        "s3:PutObject",
                        "s3:DeleteObject"
                    ],
                    "Resource": "INDEX_S3_BUCKET_ARN/*"
                }
            ]
        }
        ```

    - Update indexer role policy by attaching a policy like the following:

        ```json
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": [
                        "s3:ListBucket"
                    ],
                    "Resource": [
                        "SOURCE_S3_BUCKET_ARN",
                        "INDEX_S3_BUCKET_ARN"
                    ],
                    "Effect": "Allow"
                },
                {
                    "Action": [
                        "s3:PutObject",
                        "s3:DeleteObject"
                    ],
                    "Resource": "INDEX_S3_BUCKET_ARN/*",
                    "Effect": "Allow"
                },
                {
                    "Action": [
                        "s3:GetObject"
                    ],
                    "Resource": [
                        "SOURCE_S3_BUCKET_ARN/*",
                        "INDEX_S3_BUCKET_ARN/*"
                    ],
                    "Effect": "Allow"
                }
            ]
        }
        ```

3. Update the Docker container and CloudFormation stack you created earlier, providing your stack name, data source S3 bucket, and S3 bucket to store the index:

    ```bash
    npm run samples:deploy -- --aws-profile=<aws_cli_profile_name> --aws-region=<aws_region_name> --step=docker --stack-name=<existing_cloudformaion_stack_name> --source=s3://<source_S3_bucket_name>/ --index=s3://<index_S3_bucket_name>/
    ```

    Note the commands it outputs in the final block.

4. Run the indexer using the command provided in the previous command output. Wait for the indexer to finish by monitoring its log in CloudWatch.

5. Play with search by running the second command from the output of step 3.

## Thoughts on testing these examples

Before releasing, the following scenarios have to be tested:

1. Pull
2. Build a local index and search it from commandline
3. AWS fresh deploy, index, and search

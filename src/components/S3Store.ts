import ICreateStoreOptions from "../common/ICreateStoreOptions";
import IDataStore from "../common/IDataStore";

import AWS from "aws-sdk";

const S3_LOCATION_RX = /s3:\/\/(?<bucket>[^\/$]+)\//;

export interface IS3StoreOptions {
    bucket: string;
    credentials?: AWS.Credentials;
}

export default class S3Store<TDoc> implements IDataStore<TDoc> {
    public static parseOptions(options: ICreateStoreOptions): IS3StoreOptions | null {
        const match = options.location.match(S3_LOCATION_RX);
        if (match && match.groups) {
            const bucket = match.groups.bucket;
            if (typeof bucket === "string" && bucket.length > 0) {
                if (typeof options.credentials !== "undefined" && options.credentials instanceof AWS.Credentials) {
                    return {
                        bucket,
                        credentials: options.credentials as AWS.Credentials,
                    };
                } else {
                    return { bucket };
                }
            }
        }
        return null;
    }

    private bucketName: string;
    private s3: AWS.S3;

    constructor(options: IS3StoreOptions) {
        this.bucketName = options.bucket;
        console.log(`Initializing with ${this.bucketName}`);
        // let credentials = new AWS.EnvironmentCredentials("AWS");
        // if (options.awsProfile) {
        //     credentials = new AWS.SharedIniFileCredentials({profile: options.awsProfile});
        // }
        this.s3 = new AWS.S3({
            apiVersion: "2006-03-01",
            credentials: options.credentials,
        });
    }

    public async * readNext(): AsyncIterableIterator<{key: string, document: TDoc}> {
        const params = {
            Bucket: this.bucketName,
            ContinuationToken: null,
            MaxKeys: 10,
        };

        while (true) {
            const currentList = await this.listObjectsV2(params);

            if (!currentList || !currentList.Contents) {
                return;
            }

            for (const item of currentList.Contents) {
                yield {
                    document: await this.readItem(item.Key),
                    key: item.Key,
                };
            }

            if (currentList.NextContinuationToken) {
                params.ContinuationToken = currentList.NextContinuationToken;
            } else {
                return;
            }
        }
    }

    public async readItem(key: string): Promise<TDoc> {
        const params = {
            Bucket: this.bucketName, /* required */
            Key: key, /* required */
        };
        const item = await this.s3.getObject(params).promise();
        if (item.Body) {
            return JSON.parse(item.Body.toString());
        } else {
            throw new Error(`Item is empty at ${key}`);
        }
    }

    public async write(key: string, item: TDoc): Promise<void> {
        const params = {
            Body: JSON.stringify(item),
            Bucket: this.bucketName,
            Key: key,
        };
        await this.s3.putObject(params).promise();
    }

    private async listObjectsV2(params: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.s3.listObjectsV2(params, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
}

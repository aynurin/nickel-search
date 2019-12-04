
import AWS from "aws-sdk";
import commander from "commander";

import nickel, { ICreateStoreOptions } from "../../";

import IndexerOptions, { IDataModel } from "./model";

import defaultSource from "./source";
import defaultIndex from "./target";

commander
    .option("--data <data>", "Data source location")
    .option("--aws-profile <awsProfile>", "AWS Profile to access data (if S3 is used)")
    .option("--index <index>", "Index location")
    .parse(process.argv);

let source: ICreateStoreOptions;
let target: ICreateStoreOptions;

if (commander.data) {
    source = {
        location: commander.data,
    };
    if (commander.awsProfile) {
        source.credentials = new AWS.SharedIniFileCredentials({profile: commander.awsProfile});
    }
} else if (defaultSource) {
    source = Object.assign(defaultSource, { location: null });
}

if (commander.index) {
    target = {
        location: commander.index,
    };
    if (commander.awsProfile) {
        target.credentials = new AWS.SharedIniFileCredentials({profile: commander.awsProfile});
    }
} else if (defaultIndex) {
    target = Object.assign(defaultIndex, { location: null });
}

const options = new IndexerOptions();
options.source = nickel.createDataStore<IDataModel>(source);
options.indexStore = nickel.createIndexStore(target);

nickel.indexer(options, false).run();

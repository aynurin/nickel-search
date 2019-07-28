
import AWS from "aws-sdk";
import commander from "commander";

import nickel from "../../lib";

import IndexerOptions from "./model";

import defaultSource from "./source";
import defaultIndex from "./target";

commander
    .option("--data <data>", "Data source location")
    .option("--aws-profile <awsProfile>", "AWS Profile to access data (if S3 is used)")
    .option("--index <index>", "Index location")
    .parse(process.argv);

let source: any;
let target: any;

if (commander.data) {
    source = {
        location: commander.data,
    };
    if (commander.awsProfile) {
        source.credentials = new AWS.SharedIniFileCredentials({profile: commander.awsProfile});
    }
} else if (defaultSource) {
    source = defaultSource;
}

if (commander.index) {
    target = {
        location: commander.index,
        prefixes: 1000,
    };
    if (commander.awsProfile) {
        source.credentials = new AWS.SharedIniFileCredentials({profile: commander.awsProfile});
    }
} else if (defaultIndex) {
    target = defaultIndex;
}

const options = new IndexerOptions(source, target);
nickel.indexer(options).run();

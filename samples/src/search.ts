
import AWS from "aws-sdk";

import commander from "commander";
import readline from "readline";
import nickel, { FileStore, ICreateStoreOptions, IDataStore, IIndexPage, S3Store } from "../../";
import Colors from "./colors";

import definedIndex from "./target";

commander
    .option("--index <index>", "Index location")
    .option("--aws-profile <awsProfile>", "AWS Credentials Profile to use if the index is located in S3")
    .parse(process.argv);

let indexStoreParams: any;

if (commander.index) {
    let credentials = null;
    if (commander.awsProfile) {
        credentials = new AWS.SharedIniFileCredentials({profile: commander.awsProfile});
    }
    indexStoreParams = {
        credentials,
        location: commander.index,
    };
} else if (definedIndex) {
    indexStoreParams = definedIndex;
}

const indexStore = nickel.createIndexStore(indexStoreParams);

const ns = nickel.searcher({
    indexShards: 1000,
}, indexStore);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.setPrompt("Nickel > ");
rl.prompt();

rl.on("line", (request) => {
    return new Promise((resolve) => {
        ns.search(request)
            .then((val) => {
                if (val == null) {
                    console.error(`\n${Colors.Bright}${Colors.FgWhite}Nothing returned by server${Colors.Reset}\n`);
                } else {
                    let itemNumber = 1;
                    for (const res of val.items) {
                        const indexlabel = (itemNumber + val.pageNum * 50).toString().padStart(3);
                        console.log(`${indexlabel}. ${Colors.Bright}${Colors.FgGreen}${res.title}${Colors.Reset}` +
                            ` ${Colors.FgGreen}${res.docId}${Colors.Reset}`);
                        console.log(`     ${res.publishers.join(", ")} | ${res.authors.join(", ")}`);
                        itemNumber++;
                    }
                }
                resolve();
            })
            .catch((e) => {
                console.error(e.message);
                resolve();
            })
            .finally(() => {
                rl.prompt();
            });
    });
}).on("close", () => {
    console.log("\n\nNickel out!");
    process.exit(0);
});

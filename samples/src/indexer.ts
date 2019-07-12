
import commander from "commander";

import nickel from "../../lib";

import IDataModel from "./model";

import definedSource from "./source";
import definedTarget from "./target";

commander
    .option("--data <data>", "Data source location")
    .option("--index <index>", "Index location")
    .parse(process.argv);

let source: any;
let target: any;

// console.log("commander", commander);
console.log("source", commander.data);
console.log("target", commander.index);

if (commander.data) {
    source = {
        location: commander.data,
    };
} else if (definedSource) {
    source = definedSource;
}

if (commander.index) {
    target = {
        location: commander.index,
        prefixes: 1000,
    };
} else if (definedTarget) {
    target = definedTarget;
}

const options = {
    getDisplayedFields: (s3Uri: string, document: IDataModel) => document,
    getSearchedFields: (s3Uri: string, document: IDataModel) => ({
        Title: document.title,
    }),
    onProgress: (key: string, document: IDataModel, indexEntries: any[], counter: number) => {
        if (counter % 100 === 0) {
            console.log(`Items processed: ${counter}`);
        }
    },
    resultsPageSize: 50,
    saveThreshold: 100,
    sort: (a: IDataModel, aWeight: number, b: IDataModel, bWeight: number) => {
        let sort = bWeight - aWeight;
        if (sort === 0) {
            sort = a.title.localeCompare(b.title);
        }
        return sort;
    },
    source,
    target,
};

nickel.indexer(options).run();

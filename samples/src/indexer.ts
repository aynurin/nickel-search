import nickel from "../../lib";

import IDataModel from "./model";

import source from "./source";
import target from "./target";

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


import { ICreateStoreOptions, IIndexEntry, IIndexerOptions } from "../../lib";

export interface IDataModel {
    key: string;
    title: string;
    subtitle: string;
    publishers: string[];
    authors: string[];
    isbn_10: string | null;
    isbn_13: string | null;
    publish_date: string | null;
    subjects: string[];
}

export default class IndexerOptions implements IIndexerOptions<IDataModel> {
    public source: ICreateStoreOptions;
    public target: ICreateStoreOptions;
    public saveThreshold: number = 1000;
    public resultsPageSize: number = 100;

    constructor(source: ICreateStoreOptions, target: ICreateStoreOptions) {
        this.source = source;
        this.target = target;
    }

    public sort(a: IDataModel, aWeight: number, b: IDataModel, bWeight: number) {
        let sort = bWeight - aWeight;
        if (sort === 0) {
            sort = a.title.localeCompare(b.title);
        }
        return sort;
    }

    public getDisplayedFields(s3Uri: string, document: IDataModel) {
        return document;
    }

    public getSearchedFields(s3Uri: string, document: IDataModel) {
        return {
            Title: document.title,
        };
    }

    public onProgress(key: string, document: IDataModel, indexEntries: IIndexEntry[], counter: number) {
        if (counter % 100 === 0) {
            console.log(`Items processed: ${counter}`);
        }
    }
}

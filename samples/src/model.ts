
import { IDataStore, IIndexerOptions, IIndexPage, ISearchable } from "../../";

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
    public source: IDataStore<IDataModel>;
    public indexStore: IDataStore<IIndexPage>;
    public saveThreshold: number = 100;
    public resultsPageSize: number = 100;
    public indexShards: number = 1000;

    public sort(a: ISearchable, b: ISearchable) {
        let sort = a.weight - b.weight;
        if (sort === 0) {
            sort = a.original.title.localeCompare(b.original.title);
        }
        return sort;
    }

    public getDisplayedFields(s3Uri: string, document: IDataModel) {
        return document;
    }

    public getSearchedFields(s3Uri: string, document: IDataModel) {
        return {
            title: document.title,
        };
    }
}

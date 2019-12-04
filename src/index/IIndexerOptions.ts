
import IDataStore from "../common/IDataStore";
import IIndexPage from "../common/IIndexPage";
import ISearchable from "../common/ISearchable";

export default interface IIndexerOptions<TDoc> {
    /**
     * Data source options
     */
    source: IDataStore<TDoc>;
    /**
     * Index store options
     */
    indexStore: IDataStore<IIndexPage>;
    /**
     * How often to save intermediate results.
     */
    saveThreshold: number;
    resultsPageSize: number;
    indexShards: number;
    /**
     * Requried. Implement to set search results sort order.
     */
    sort: (a: ISearchable, b: ISearchable) => number;
    /**
     * Required. Implement to set which fields to return with search results.
     */
    getDisplayedFields: (s3Uri: string, document: TDoc) => any;
    /**
     * Required. Implement to set which fields need to be searched for.
     */
    getSearchedFields: (s3Uri: string, document: TDoc) => any;
    /**
     * Report progress during indexing.
     */
    onProgress?: (stage: string, key?: string, document?: any, itemsProcessed?: number, totalItems?: number) => any;
}

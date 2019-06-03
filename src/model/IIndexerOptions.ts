import IIndexEntry from "./IIndexEntry";

export default interface IIndexerOptions<TDoc> {
    /**
     * Data source options
     */
    source: any;
    /**
     * Index store options
     */
    target: any;
    /**
     * How often to save intermediate results.
     */
    saveThreshold: number;
    resultsPageSize: number;
    /**
     * Requried. Implement to set search results sort order.
     */
    sort: (a: TDoc, aWeight: number, b: TDoc, bWeight: number) => number;
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
    onProgress: (key: string, document: TDoc, indexEntries: IIndexEntry[], counter: number) => any;
}


/**
 * A representation of one searchable prefix for one document with
 * all the searched and displayed fields and other necessary things
 */
export default interface ISearchable {
    /**
     * The prefix to be searched
     */
    value: string;
    /**
     * Fields where the prefix was found
     */
    fields: string[];
    /**
     * ID (key) of the document as received from (source: IDataStore<TDoc>).readNext().
     */
    docId: string;
    /**
     * Weight of the search term (this.value) in relation to the document identified by this.docId.
     */
    weight: number;
    /**
     * Any metadata to display when returning this as a search result.
     */
    metadata?: any;
    /**
     * Original document (will be wiped out before saving).
     */
    original?: any;
}

import IDataStore from "./common/IDataStore";
import IIndexPage from "./common/IIndexPage";
import IndexRecord from "./common/IndexRecord";
import IWordTokenizer from "./common/IWordTokenizer";

/** Usage example: see /samples/src/search.ts
 */
/** Usage example:
 * import { S3Store, SimpleTokenizer } from "nickel-search/components/S3Store"
 * import NickelSearch from "nickel-search/Search"
 *
 * const s3Options = {
 *      bucket: "s3://my-bucket-name/",
 *      credentials: new AWS.SharedIniFileCredentials({profile: "my-aws-profile-name"}),
 * }
 *
 * const nickel = new NickelSearch(
 *      { indexShards: 1000 },
 *      new S3Store(s3Options),
 *      new SimpleTokenizer());
 *
 * await nickel.search("term");
 */

export interface ISearchOptions {
    indexShards: number;
}

export default class NickelSearch {
    private options: ISearchOptions;
    private source: IDataStore<IIndexPage>;
    private tokenizer: IWordTokenizer;

    constructor(options: ISearchOptions, source: IDataStore<IIndexPage>, tokenizer: IWordTokenizer) {
        this.options = options;
        this.source = source;
        this.tokenizer = tokenizer;
    }

    public async search(term: string): Promise<IIndexPage | null> {
        const searchtokens = this.tokenizer.tokenize(term)
            .map((query) => IndexRecord.createFromSearchQuery(query, this.options.indexShards));
        return await this.getPage(searchtokens[0].getPageUri(0));
    }

    public async getPage(pageKey: string): Promise<IIndexPage | null> {

        const hrstart = process.hrtime();
        try {
            const result = await this.source.readItem(pageKey);
            const hrend = process.hrtime(hrstart);
            console.debug(`Retrieving key ${pageKey} took: ${hrend[0]}s ${hrend[1] / 1000000}ms`);
            return result;
        } catch (e) {
            const hrend = process.hrtime(hrstart);
            console.debug(`Retrieving key ${pageKey} took: ${hrend[0]}s ${hrend[1] / 1000000}ms`);
            if (e.code === "NoSuchKey") {
                throw new Error(`Object with key ${pageKey} was not found`);
            }
            throw e;
        }
    }
}

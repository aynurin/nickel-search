import IDataStore from "./common/IDataStore";
import IIndexPage from "./common/IIndexPage";
import IndexRecord from "./common/IndexRecord";
import IWordTokenizer from "./common/IWordTokenizer";

import EntryNotFoundError from "./EntryNotFoundError";
import { SimpleTokenizer } from "./NickelIndex";

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
        const mark = time();
        try {
            const result = await this.source.readItem(pageKey);
            console.debug(`Retrieving key ${pageKey} took: ${toMSString(time(mark))}s`);
            return result;
        } catch (e) {
            console.debug(`Retrieving key ${pageKey} took: ${toMSString(time(mark))}s`);
            if (e instanceof EntryNotFoundError) {
                console.warn(`Key not found: ${pageKey}`);
                return null;
            } else {
                throw e;
            }
        }
    }
}

function toMSString(val: Date) {
    return val.getSeconds() + val.getMilliseconds() / 1000;
}

function time(baseTime?: Date) {
    const currentDate = new Date();
    if (baseTime) {
        return new Date(currentDate.valueOf() - baseTime.valueOf());
    } else {
        return currentDate;
    }
}

export { IDataStore, IIndexPage, SimpleTokenizer };

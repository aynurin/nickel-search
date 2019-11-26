
import IDataStore from "./components/IDataStore";
import IWordTokenizer from "./components/IWordTokenizer";
import SimpleTokenizer from "./components/SimpleTokenizer";
import IndexRecord from "./IndexRecord";
import IIndexPage from "./model/IIndexPage";
import ISearchOptions from "./model/ISearchOptions";

export default class NickelSearch {
    private options: ISearchOptions;
    private source: IDataStore<IIndexPage>;
    private tokenizer: IWordTokenizer;

    constructor(options: ISearchOptions, source: IDataStore<IIndexPage>) {
        this.options = options;
        this.source = source;
        this.tokenizer = new SimpleTokenizer();
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

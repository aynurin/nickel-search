import IDataStore from "./components/IDataStore";

import { fileKey } from "./Utils";

import IIndexPage from "./model/IIndexPage";
import ISearchOptions from "./model/ISearchOptions";

export default class NickelSearch {
    private options: ISearchOptions;
    private source: IDataStore<IIndexPage>;

    constructor(options: ISearchOptions, source: IDataStore<IIndexPage>) {
        this.options = options;
        this.source = source;
    }

    public async search(term: string): Promise<IIndexPage | null> {
        return await this.getPage(fileKey(0, term.toLowerCase(), this.options.indexShards));
    }

    public async getPage(pageKey: string): Promise<IIndexPage | null> {
        const [b64key, index] = pageKey.replace(".json", "").split("/")[1].split("-");
        const key = Buffer.from(b64key, "base64").toString();

        const hrstart = process.hrtime();
        try {
            const result = await this.source.readItem(pageKey);
            const hrend = process.hrtime(hrstart);
            console.debug(`Retrieving key ${key}-${index} (${pageKey}) took: ${hrend[0]}s ${hrend[1] / 1000000}ms`);
            return result;
        } catch (e) {
            const hrend = process.hrtime(hrstart);
            console.debug(`Retrieving key ${key}-${index} (${pageKey}) took: ${hrend[0]}s ${hrend[1] / 1000000}ms`);
            if (e.code === "NoSuchKey") {
                throw new Error(`Object with key ${key}-${index} was not found`);
            }
            throw e;
        }
    }
}

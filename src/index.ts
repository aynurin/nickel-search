import { createStore } from "./Utils";

import ICreateStoreOptions from "./model/ICreateStoreOptions";
import IIndexEntry from "./model/IIndexEntry";
import IIndexPage from "./model/IIndexPage";

import IIndexerOptions from "./model/IIndexerOptions";
import ISearchOptions from "./model/ISearchOptions";

import NickelIndex from "./NickelIndex";
import NickelSearch from "./NickelSearch";

export default class Nickel {
    public static searcher(options: ISearchOptions): NickelSearch {
        const source = createStore<IIndexPage>(options.source);
        if (!source) {
            throw new Error(`Could not create data source from ${JSON.stringify(options.source)}`);
        }
        return new NickelSearch(options, source);
    }

    public static indexer<TDoc>(options: IIndexerOptions<TDoc>): NickelIndex<TDoc> {
        const source = createStore<TDoc>(options.source);
        if (!source) {
            throw new Error(`Could not create data source from ${JSON.stringify(options.source)}`);
        } else {
            console.log("Data source created for", JSON.stringify(options.source));
        }
        const target = createStore<IIndexPage>(options.target);
        if (!target) {
            throw new Error(`Could not create index target from ${JSON.stringify(options.target)}`);
        } else {
            console.log("Index store created for", JSON.stringify(options.target));
        }
        return new NickelIndex(options, source, target);
    }
}

export { ICreateStoreOptions, ISearchOptions, IIndexerOptions, IIndexEntry };

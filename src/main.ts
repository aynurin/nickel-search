import ICreateStoreOptions from "./common/ICreateStoreOptions";
import IIndexPage from "./common/IIndexPage";
import ISearchable from "./common/ISearchable";

import IIndexerOptions from "./index/IIndexerOptions";
import { ISearchOptions } from "./NickelSearch";

import NickelIndex from "./NickelIndex";
import NickelSearch from "./NickelSearch";

import IDataStore from "./common/IDataStore";
import FileStore from "./components/FileStore";
import RamPrefixBuffer from "./components/RamPrefixBuffer";
import S3Store from "./components/S3Store";
import SimpleTokenizer from "./components/SimpleTokenizer";
import TmpPrefixBuffer from "./components/TmpPrefixBuffer";

import BasePrefixBuffer from "./index/PrefixBuffer";

const DEFAULT_TOKENIZER = new SimpleTokenizer();

export default class Nickel {
    public static searcher(searchOptions: ISearchOptions, dataSource: IDataStore<IIndexPage>): NickelSearch {
        return new NickelSearch(searchOptions, dataSource, DEFAULT_TOKENIZER);
    }

    public static createIndexStore(options: ICreateStoreOptions): IDataStore<IIndexPage> {
        return Nickel.createDataStore<IIndexPage>(options);
    }

    public static createDataStore<TDoc>(options: ICreateStoreOptions): IDataStore<TDoc> {
        const source = createStore<TDoc>(options);
        if (!source) {
            throw new Error(`Could not create data store from ${JSON.stringify(options)}`);
        }
        return source;
    }

    public static indexer<TDoc>(options: IIndexerOptions<TDoc>, useRAMBuffer: boolean): NickelIndex<TDoc> {
        return new NickelIndex(options, createPrefixBuilder(useRAMBuffer), DEFAULT_TOKENIZER);
    }
}

function createPrefixBuilder(useRAMBuffer: boolean): BasePrefixBuffer {
    if (useRAMBuffer === true) {
        return new RamPrefixBuffer();
    } else {
        return new TmpPrefixBuffer();
    }
}

function createStore<TDoc>(options: ICreateStoreOptions):
        IDataStore<TDoc> | null {
    if (options && options.location && typeof options.location === "string") {
        const s3Options = S3Store.parseOptions(options); // { bucket: location, awsCredentials: options.credentials }
        if (s3Options != null) {
            return new S3Store<TDoc>(s3Options);
        }
        const filestoreOptions = FileStore.parseOptions(options);
        if (filestoreOptions != null) {
            return new FileStore<TDoc>(filestoreOptions);
        }
    }
    return null;
}

export { ICreateStoreOptions, IDataStore, ISearchOptions,
         IIndexerOptions, ISearchable, IIndexPage, S3Store, FileStore };

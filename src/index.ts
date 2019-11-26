import ICreateStoreOptions from "./model/ICreateStoreOptions";
import IIndexPage from "./model/IIndexPage";
import ISearchable from "./model/ISearchable";

import IIndexerOptions from "./model/IIndexerOptions";
import ISearchOptions from "./model/ISearchOptions";

import NickelIndex from "./NickelIndex";
import NickelSearch from "./NickelSearch";

import IDataStore from "./components/IDataStore";

import { getTempDir } from "./components/TempDir";

import { LocalFilePrefixBuilder, RamPrefixBuffer } from "./PrefixBuffer";

export default class Nickel {
    public static async searcher(options: ISearchOptions): Promise<NickelSearch> {
        const source = await createStore<IIndexPage>(options.source);
        if (!source) {
            throw new Error(`Could not create data source from ${JSON.stringify(options.source)}`);
        }
        return new NickelSearch(options, source);
    }

    public static async indexer<TDoc>(options: IIndexerOptions<TDoc>): Promise<NickelIndex<TDoc>> {
        const source = await createStore<TDoc>(options.source);
        if (!source) {
            throw new Error(`Could not create data source from ${JSON.stringify(options.source)}`);
        } else {
            console.log("Data source created for", JSON.stringify(options.source));
        }
        const target = await createStore<IIndexPage>(options.target);
        if (!target) {
            throw new Error(`Could not create index target from ${JSON.stringify(options.target)}`);
        } else {
            console.log("Index store created for", JSON.stringify(options.target));
        }
        const tempDir = await getTempDir();
        const prefixBuilder = new LocalFilePrefixBuilder(tempDir);
        return new NickelIndex(options, source, target, prefixBuilder);
    }
}

async function createStore<TDoc>(options: ICreateStoreOptions):
        Promise<IDataStore<TDoc> | null> {
    if (options && options.location && typeof options.location === "string") {
        const S3Store = (await import("./S3Store")).default;
        const s3Options = S3Store.parseOptions(options); // { bucket: location, awsCredentials: options.credentials }
        if (s3Options != null) {
            return new S3Store<TDoc>(s3Options);
        } else {
            const FileStore = (await import("./FileStore")).default;
            const filestoreOptions = FileStore.parseOptions(options);
            if (filestoreOptions != null) {
                return new FileStore<TDoc>(filestoreOptions);
            }
        }
    }
    return null;
}

export { ICreateStoreOptions, ISearchOptions, IIndexerOptions, ISearchable, IIndexPage };

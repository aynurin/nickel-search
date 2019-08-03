import IDataStore from "./components/IDataStore";
import ITransform from "./components/ITransform";

import SearchTransform from "./SearchTransform";
import SimpleTokenizer from "./SimpleTokenizer";
import { fileKey, memusage } from "./Utils";

import IIndexEntry from "./model/IIndexEntry";
import IIndexerOptions from "./model/IIndexerOptions";
import IIndexPage from "./model/IIndexPage";

import { BasePrefixBuffer } from "./PrefixBuffer";

export default class NickelIndex<TDoc> {
    private options: IIndexerOptions<TDoc>;
    private source: IDataStore<TDoc>;
    private searchTransform: ITransform<any, IIndexEntry[]>;
    private counter: number;
    private indexStore: IDataStore<IIndexPage>;
    private prefixBuffer: BasePrefixBuffer;
    private finishedPrefixCount: number = 0;

    constructor(options: IIndexerOptions<TDoc>,
                source: IDataStore<TDoc>, target: IDataStore<IIndexPage>,
                prefixBuffer: BasePrefixBuffer) {
        if (options.resultsPageSize < 1) {
            options.resultsPageSize = 1;
        }
        this.options = options;
        this.source = source;
        this.indexStore = target;
        this.searchTransform = new SearchTransform(new SimpleTokenizer());
        this.counter = 0;
        this.prefixBuffer = prefixBuffer;
    }

    /**
     * Should probably be refactored so that the public interface looks more like:
     * ```
     * while (doc = source.read)
     *      index.write(doc);
     * ```
     */
    /**
     * Runs indexing
     */
    public async run(): Promise<void> {
        for await (const received of this.source.readNext()) {
            if (received != null) {
                const {document, key} = received;
                const indexEntries = this.transform(key, document);
                await Promise.all(indexEntries.map((indexEntry) =>
                    this.prefixBuffer.add(indexEntry.value, indexEntry)));
                this.counter++;
                this.reportProgress("indexing", key, document, this.counter);
            }
        }
        this.reportProgress("Indexing done");
        const waiters = new Array<Promise<void>>();
        const iterator = this.prefixBuffer.forEachPrefix((_, entries) =>
            this.saveIndex(entries.indexKey, entries));
        for (const received of iterator) {
            waiters.push(received);
            if (waiters.length >= 100) {
                await Promise.all(waiters);
                waiters.length = 0;
            }
        }
        await Promise.all(waiters);
        this.reportProgress("All done");
    }

    public transform(s3Uri: string, document: TDoc): IIndexEntry[] {
        const searchedFields = this.options.getSearchedFields(s3Uri, document);
        const displayedFields = this.options.getDisplayedFields(s3Uri, document);
        const indexEntries = this.searchTransform.apply(s3Uri, searchedFields);
        for (const indexEntry of indexEntries) {
            indexEntry.metadata = displayedFields;
            indexEntry.original = searchedFields;
        }
        return indexEntries;
    }

    private reportProgress(stage: string, key?: string, document?: any, itemsProcessed?: number, totalItems?: number) {
        if (this.options.onProgress) {
            this.options.onProgress(stage, key, document, itemsProcessed, totalItems);
        } else {
            let message = `NickelIndex ${stage}`;
            if (itemsProcessed) {
                if (itemsProcessed % 100 === 0) {
                    message += ", " + itemsProcessed;
                    if (totalItems && totalItems > 0) {
                        message += " of " + totalItems;
                    }
                    console.log(message);
                    memusage();
                }
            } else {
                console.log(message);
                memusage();
            }
        }
    }

    private async saveIndex(indexKey: string, entries: IIndexEntry[]): Promise<void> {
        const sortedEntries = entries
            .sort(this.options.sort)
            .map((value) => ({
                docId: value.docId,
                ...value.metadata,
            }));
        let stored = 0;
        let startFrom = 0;
        let pageNum = 0;
        while (stored < sortedEntries.length) {
            const thisPage = sortedEntries.slice(startFrom, startFrom + this.options.resultsPageSize);
            startFrom = startFrom + this.options.resultsPageSize;
            const pageData = {
                count: sortedEntries.length,
                index: indexKey,
                items: thisPage,
                nextPageUri: stored + thisPage.length < entries.length ?
                    fileKey(pageNum + 1, indexKey, this.options.indexShards) : null,
                pageNum,
                pageSize: this.options.resultsPageSize,
                pageUri:
                    fileKey(pageNum, indexKey, this.options.indexShards),
                previousPageUri: pageNum > 0 ?
                    fileKey(pageNum - 1, indexKey, this.options.indexShards) : null,
            };
            await this.indexStore.write(pageData.pageUri, pageData);
            pageNum++;
            stored += thisPage.length;
        }
        this.finishedPrefixCount++;
        this.reportProgress("sorting", indexKey, entries, this.finishedPrefixCount);
    }
}

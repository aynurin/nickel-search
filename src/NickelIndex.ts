import IDataStore from "./components/IDataStore";
import ITransform from "./components/ITransform";

import SearchTransform from "./SearchTransform";
import SimpleTokenizer from "./SimpleTokenizer";
import { fileKey } from "./Utils";

import IIndexEntry from "./model/IIndexEntry";
import IIndexerOptions from "./model/IIndexerOptions";
import IIndexPage from "./model/IIndexPage";

import IndexDefinition from "./IndexDefinition";
import TempIndexStore from "./TempIndexStore";

export default class NickelIndex<TDoc> {
    private options: IIndexerOptions<TDoc>;
    private source: IDataStore<TDoc>;
    private searchTransform: ITransform<any, IIndexEntry[]>;
    private counter: number;
    private indexDefinitions: { [prefix: string]: IndexDefinition; } = { };
    private indexStore: IDataStore<IIndexPage>;
    private tempStore: TempIndexStore;

    constructor(options: IIndexerOptions<TDoc>, source: IDataStore<TDoc>, target: IDataStore<IIndexPage>) {
        if (options.resultsPageSize < 1) {
            options.resultsPageSize = 1;
        }
        this.options = options;
        this.source = source;
        this.indexStore = target;
        this.searchTransform = new SearchTransform(new SimpleTokenizer());
        this.counter = 0;
        this.tempStore = new TempIndexStore(this.options.indexShards, this.options.saveThreshold, "./temp");
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
                for (const indexEntry of indexEntries) {
                    const definition = this.getIndexFor(indexEntry);
                    definition.add(indexEntry); // save a temporary file every 100 elements.
                                                // when all done, re-read everything, sort, and save pages.
                                                // we'll need local storage to do that.
                    await definition.flushToTempFileOnThreshold();
                }
                this.counter++;
                this.reportProgress("indexing", key, document, this.counter);
            }
        }
        this.reportProgress("Indexing done");
        const totalNumber = Object.values(this.indexDefinitions).length;
        let finishedNumber = 0;
        for (const index of Object.values(this.indexDefinitions)) {
            await index.loadAllTempData();
            await this.saveIndex(index);
            finishedNumber++;
            this.reportProgress("sorting", index.indexKey, index, finishedNumber, totalNumber);
        }
        this.reportProgress("All done");
    }

    public transform(s3Uri: string, document: TDoc): IIndexEntry[] {
        const indexFields = this.searchTransform.apply(s3Uri,
            this.options.getSearchedFields(s3Uri, document));
        for (const field of indexFields) {
            field.metadata = this.options.getDisplayedFields(s3Uri, document);
            field.original = document;
        }
        return indexFields;
    }

    private getIndexFor(indexEntry: IIndexEntry): IndexDefinition {
        // we cannot use indexEntry.value directly as it contains natural data
        // and js array/dictionary indexers are not from the natural domain
        // being very flexible, they still have their limitations, e.g. such words as
        // 'constructor' or 'toString' can behave in a different way
        const index = Buffer.from(indexEntry.value).toString("base64");
        const definition = index in this.indexDefinitions
            ? this.indexDefinitions[index]
            : (this.indexDefinitions[index] =
                new IndexDefinition(indexEntry.value, this.tempStore));
        return definition;
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
                    this.memusage();
                }
            } else {
                console.log(message);
                this.memusage();
            }
        }
    }

    private memusage() {
        const used = process.memoryUsage();
        console.log(`MEM: external ${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`);
        console.log(`MEM: heapTotal ${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`);
        console.log(`MEM: heapUsed ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
        console.log(`MEM: rss ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`);
    }

    private async saveIndex(index: IndexDefinition): Promise<void> {
        const entries = index.entries.sort((a, b) => this.options.sort(a.original, a.weight, b.original, b.weight))
            .map((value) => ({
                docId: value.docId,
                ...value.metadata,
            }));
        let stored = 0;
        let startFrom = 0;
        let pageNum = 0;
        while (stored < entries.length) {
            const thisPage = entries.slice(startFrom, startFrom + this.options.resultsPageSize);
            startFrom = startFrom + this.options.resultsPageSize;
            const pageData = {
                count: entries.length,
                index: index.indexKey,
                items: thisPage,
                nextPageUri: stored + thisPage.length < entries.length ?
                    fileKey(pageNum + 1, index.indexKey, this.options.indexShards) : null,
                pageNum,
                pageSize: this.options.resultsPageSize,
                pageUri:
                    fileKey(pageNum, index.indexKey, this.options.indexShards),
                previousPageUri: pageNum > 0 ?
                    fileKey(pageNum - 1, index.indexKey, this.options.indexShards) : null,
            };
            await this.indexStore.write(pageData.pageUri, pageData);
            pageNum++;
            stored += thisPage.length;
        }
    }
}

import IDataStore from "./common/IDataStore";
import IIndexPage from "./common/IIndexPage";
import IndexRecord from "./common/IndexRecord";
import ISearchable from "./common/ISearchable";
import IWordTokenizer from "./common/IWordTokenizer";

import IIndexerOptions from "./index/IIndexerOptions";
import BasePrefixBuffer from "./index/PrefixBuffer";
import SearchTransform from "./index/SearchTransform";

/** Usage example: see /samples/src/indexer.ts
 */

export default class NickelIndex<TDoc> {
    private options: IIndexerOptions<TDoc>;
    private source: IDataStore<TDoc>;
    private searchTransform: SearchTransform;
    private counter: number;
    private indexStore: IDataStore<IIndexPage>;
    private prefixBuffer: BasePrefixBuffer;
    private finishedPrefixCount: number = 0;

    constructor(options: IIndexerOptions<TDoc>,
                prefixBuffer: BasePrefixBuffer,
                tokenizer: IWordTokenizer) {
        if (options.resultsPageSize < 1) {
            options.resultsPageSize = 1;
        }
        this.options = options;
        this.source = options.source;
        this.indexStore = options.indexStore;
        this.searchTransform = new SearchTransform(tokenizer);
        this.counter = 0;
        this.prefixBuffer = prefixBuffer;
    }

    /**
     * Runs indexing. This very much looks like ReadStream -> TransformStream -> WriteStream, but
     * it is difficult to achieve a defined level of paralellism at all stages, so for now
     * all "streams" are just custom classes.
     */
    public async run(): Promise<void> {
        // read all entities to be indexed (see source: IDataStore<TDoc>)
        for await (const received of this.source.readNext()) {
            if (received != null) {
                const {document, key} = received;
                // transform them into searchable records (see searchTransform: ITransform<in,out>)
                const indexRecords = this.transform(key, document)
                    .map((searchable) => new IndexRecord(searchable, this.options.indexShards));
                // store the received records in a temporary storage (see BasePrefixBuffer)
                await Promise.all(indexRecords.map((index) => this.prefixBuffer.add(index)));
                this.counter++;
                this.reportProgress("indexing", key, document, this.counter);
            }
        }
        this.reportProgress("Indexing done. " +
            `${this.prefixBuffer.addCompleted} of ${this.prefixBuffer.addRequests} entries from ` +
            `${this.counter} documents added`);
        const waiters = new Array<Promise<void>>();
        // sort (this.options.sort)
        // and start saving into final storage (see indexStore: IDataStore<IIndexPage>)
        console.log("NickelIndex: waiting for saveIndex...");
        await this.prefixBuffer.forEachPrefix(async (index: IndexRecord[]) => await this.saveIndex(index), 100);
        this.reportProgress("All done");
    }

    public transform(s3Uri: string, document: TDoc): ISearchable[] {
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
                    // memusage();
                }
            } else {
                console.log(message);
                // memusage();
            }
        }
    }

    private async saveIndex(index: IndexRecord[]): Promise<void> {
        const sortedEntries = index
            .sort((a, b) => this.options.sort(a.searchable, b.searchable))
            .map((value) => ({
                docId: value.searchable.docId,
                ...value.searchable.metadata,
            }));
        let stored = 0;
        let startFrom = 0;
        let pageNum = 0;
        while (stored < sortedEntries.length) {
            const thisPage = sortedEntries.slice(startFrom, startFrom + this.options.resultsPageSize);
            startFrom = startFrom + this.options.resultsPageSize;
            const pageData = {
                count: sortedEntries.length,
                index: index[0].key,
                items: thisPage,
                nextPageUri: stored + thisPage.length < index.length ?
                    index[0].getPageUri(pageNum + 1) : null,
                pageNum,
                pageSize: this.options.resultsPageSize,
                pageUri:
                    index[0].getPageUri(pageNum),
                previousPageUri: pageNum > 0 ?
                    index[0].getPageUri(pageNum - 1) : null,
            };
            await this.indexStore.write(pageData.pageUri, pageData);
            pageNum++;
            stored += thisPage.length;
        }
        this.finishedPrefixCount++;
        this.reportProgress("sorting", index[0].key, index, this.finishedPrefixCount);
    }
}

// function memusage() {
//     const used = process.memoryUsage();
//     console.debug(`MEM (${process.pid}):`,
//         mem("ext", used.external),
//         mem("het", used.heapTotal),
//         mem("heu", used.heapUsed),
//         mem("rss", used.rss));
// }

// function mem(title: string, val: number): string {
//     return `${title} ${(Math.round(val / 1024 / 1024 * 100) / 100)} MB`.padEnd(8 + title.length, " ");
// }

export { IDataStore, IIndexerOptions, ISearchable, IIndexPage };

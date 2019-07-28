import IDataStore from "./components/IDataStore";
import ITransform from "./components/ITransform";

import SearchTransform from "./SearchTransform";
import SimpleTokenizer from "./SimpleTokenizer";
import { fileKey } from "./Utils";

import IIndexEntry from "./model/IIndexEntry";
import IIndexerOptions from "./model/IIndexerOptions";
import IIndexPage from "./model/IIndexPage";
import IndexDefinition from "./model/IndexDefinition";

export default class NickelIndex<TDoc> {
    private options: IIndexerOptions<TDoc>;
    private source: IDataStore<TDoc>;
    private searchTransform: ITransform<any, IIndexEntry[]>;
    private counter: number;
    private indexDefinitions: { [prefix: string]: IndexDefinition; } = { };
    private target: IDataStore<IIndexPage>;

    constructor(options: IIndexerOptions<TDoc>, source: IDataStore<TDoc>, target: IDataStore<IIndexPage>) {
        if (options.resultsPageSize < 1) {
            options.resultsPageSize = 1;
        }
        this.options = options;
        this.source = source;
        this.target = target;
        this.searchTransform = new SearchTransform(new SimpleTokenizer());
        this.counter = 0;
    }

    public async run(): Promise<void> {
        for await (const received of this.source.readNext()) {
            if (received != null) {
                const {document, key} = received;
                const indexEntries = this.transform(key, document);
                await this.write(key, indexEntries);
                this.counter++;
                if (this.options.onProgress) {
                    this.options.onProgress(key, document, indexEntries, this.counter);
                }
            }
        }
        let totalNumber = Object.values(this.indexDefinitions).length;
        let finishedNumber = 0;
        for (const index of Object.values(this.indexDefinitions)) {
            if (index.itemsAddedAfterSave > 0) {
                await this.saveIndex(index);
                finishedNumber++;
            } else {
                totalNumber--;
            }
            if (finishedNumber % 100 === 0 || finishedNumber === totalNumber) {
                console.log(`Saving tail definition ${finishedNumber} of ${totalNumber}`);
            }
        }
        console.log("All done");
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

    public async write(key: string, indexEntries: IIndexEntry[]): Promise<void> {
        for (const indexEntry of indexEntries) {
            const definition = this.getIndexFor(indexEntry);
            definition.add(indexEntry);
            if (definition.isThresholdReached()) {
                console.log(`Saving index for ${definition.indexKey}`);
                await this.saveIndex(definition);
                definition.resetThreshold();
            }
        }
    }

    private getIndexFor(indexEntry: IIndexEntry): IndexDefinition {
        // we cannot use indexEntry.value directly as it contains natural data
        // and js array/dictionary indexers are not from the natural domain
        // being very flexible, they still have their limitations, e.g. such words as
        // 'constructor' or 'toString' can behave in a different way
        const index = Buffer.from(indexEntry.value).toString("base64");
        const definition = index in this.indexDefinitions
            ? this.indexDefinitions[index]
            : (this.indexDefinitions[index] = new IndexDefinition(indexEntry.value, this.options.saveThreshold));
        return definition;
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
                    fileKey(pageNum + 1, index.indexKey, this.options.target.prefixes) : null,
                pageNum,
                pageSize: this.options.resultsPageSize,
                pageUri:
                    fileKey(pageNum, index.indexKey, this.options.target.prefixes),
                previousPageUri: pageNum > 0 ?
                    fileKey(pageNum - 1, index.indexKey, this.options.target.prefixes) : null,
            };
            await this.target.write(pageData.pageUri, pageData);
            pageNum++;
            stored += thisPage.length;
        }
    }
}

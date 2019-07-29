
import IIndexEntry from "./model/IIndexEntry";
import TempIndexStore from "./TempIndexStore";

/**
 * Stores pointers to index leafs. E.g. index definition for "abc" would store
 * all documents that should be returned for "abc" search.
 */
export default class IndexDefinition {
    public indexKey: string;
    public entries: IIndexEntry[] = [];
    public itemsAddedAfterSave: number;
    private pageNum: number;
    private indexStore: TempIndexStore;

    constructor(indexKey: string, indexStore: TempIndexStore) {
        this.indexKey = indexKey;
        this.itemsAddedAfterSave = 0;
        this.pageNum = 0;
        this.indexStore = indexStore;
    }
    public add(item: IIndexEntry) {
        this.entries.push(item);
        this.itemsAddedAfterSave++;
    }
    public resetThreshold() {
        this.itemsAddedAfterSave = 0;
    }
    public async flushToTempFileOnThreshold() {
        if (this.indexStore.isThresholdReached(this.itemsAddedAfterSave)) {
            await this.indexStore.saveTemp(this.indexKey, this.pageNum, this.entries);
            this.entries = [];
            this.pageNum++;
            this.resetThreshold();
        }
    }
    public async loadAllTempData() {
        const maxPages = this.pageNum;
        const tail = this.entries;
        this.entries = [];
        for (let i = 0; i < maxPages; i++) {
            const entries = await this.indexStore.loadTemp(this.indexKey, i);
            for (const entry of entries) {
                this.entries.push(entry);
            }
        }
        for (const entry of tail) {
            this.entries.push(entry);
        }
    }
}

import IIndexEntry from "./IIndexEntry";

export default class IndexDefinition {
    public indexKey: string;
    public entries: IIndexEntry[] = [];
    public saveThreshold: number;
    public itemsAddedAfterSave: number;
    constructor(indexKey: string, saveThreshold: number) {
        this.indexKey = indexKey;
        this.saveThreshold = saveThreshold;
        this.itemsAddedAfterSave = 0;
    }
    public add(item: IIndexEntry) {
        this.entries.push(item);
        this.itemsAddedAfterSave++;
    }
    public isThresholdReached() {
        return this.itemsAddedAfterSave >= this.saveThreshold;
    }
    public resetThreshold() {
        this.itemsAddedAfterSave = 0;
    }
}

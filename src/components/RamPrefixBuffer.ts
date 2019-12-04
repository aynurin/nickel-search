
import BasePrefixBuffer, { IndexRecordSet } from "../index/PrefixBuffer";

import IndexRecord from "../common/IndexRecord";
import * as indexModel from "../common/IndexRecord";

export default class RamPrefixBuffer extends BasePrefixBuffer {
    private indexDefinitions: Map<string, IndexRecordSet> = new Map();

    public add(record: IndexRecord): Promise<void> {
        this.getEntryContainer(record).push(record);
        return Promise.resolve();
    }

    public load(safeKey: indexModel.recordSafeKey): Promise<IndexRecordSet> {
        return Promise.resolve(this.getEntryContainer(undefined, safeKey));
    }

    public async forEachPrefix<T>(
        fn: (index: IndexRecordSet) => Promise<T>,
        maxParallelJobs: number): Promise<T[]> {
        return await this.batchForEach(Array.from(this.indexDefinitions.values()), fn, maxParallelJobs);
    }

    private getEntryContainer(record?: IndexRecord, safeKey?: indexModel.recordSafeKey):
                              IndexRecordSet {
        if (record == null && safeKey == null) {
            throw new Error("Invalid arguments: either record or safeKey should be defined");
        }
        // indexSafeKey cannot be undefined after the previous check
        const indexSafeKey = record == null ? safeKey! : record.safekey;
        let definition = this.indexDefinitions.get(indexSafeKey);
        if (!definition) {
            definition = new IndexRecordSet(indexSafeKey);
            this.indexDefinitions.set(indexSafeKey, definition);
        }
        return definition;
    }
}

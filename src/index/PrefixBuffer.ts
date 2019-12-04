
import IndexRecord from "../common/IndexRecord";
import * as indexModel from "../common/IndexRecord";

export default abstract class BasePrefixBuffer {
    public addRequests: number = 0;
    public addCompleted: number = 0;

    public abstract add(record: IndexRecord): Promise<void>;
    public abstract load(safeKey: indexModel.recordSafeKey): Promise<IndexRecordSet>;
    public abstract forEachPrefix<T>(
        fn: (index: IndexRecordSet) => Promise<T>,
        maxParallelJobs: number): Promise<T[]>;

    protected async batchForEach<TIn, TOut>(
        inputCollection: TIn[],
        convert: (input: TIn) => Promise<TOut>,
        maxJobsInBatch: number): Promise<TOut[]> {
        const waiters: Array<Promise<TOut>> = [];
        let results: TOut[] = [];
        for (const item of inputCollection) {
            if (maxJobsInBatch <= 1) {
                results.push(await convert(item));
            } else {
                const oneWaiter = convert(item);
                waiters.push(oneWaiter);
                if (waiters.length >= maxJobsInBatch) {
                    results = results.concat(await Promise.all(waiters));
                    waiters.length = 0;
                }
            }
        }
        results = results.concat(await Promise.all(waiters));
        return results;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class IndexRecordSet extends Array<IndexRecord> {
    public safeKey: indexModel.recordSafeKey;

    constructor(safeKey: indexModel.recordSafeKey) {
        super();
        this.safeKey = safeKey;
    }
}

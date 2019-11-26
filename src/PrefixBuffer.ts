
import fs from "fs";
import path from "path";

import * as ostream from "./components/ObjectStreams";

import IndexRecord from "./IndexRecord";
import * as indexModel from "./IndexRecord";
import ISearchable from "./model/ISearchable";

export abstract class BasePrefixBuffer {
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
export class RamPrefixBuffer extends BasePrefixBuffer {
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

// tslint:disable-next-line: max-classes-per-file
export class LocalFilePrefixBuilder extends BasePrefixBuffer {
    public readonly indexDefinitions: Map<string, IndexRecord> = new Map();
    private readonly rootPath: string;

    constructor(rootPath: string) {
        super();
        this.rootPath = rootPath;
    }

    public async add(record: IndexRecord): Promise<void> {
        this.addRequests++;

        const containerFileName = await this.getContainerFileName(record, true);
        const fileStream = fs.createWriteStream(containerFileName, { flags: "a" });
        const objStream = new ostream.EntityToBytesTransformStream();

        const endstreams = (async () => new Promise((resolve, reject) => {
            fileStream.on("close", () => {
                if (!this.indexDefinitions.has(record.safekey)) {
                    this.indexDefinitions.set(record.safekey, record);
                }
                this.addCompleted++;
                resolve();
            });
            fileStream.on("error", (err) => reject(err));
            objStream.on("error", (err) => reject(err));
        }))();

        objStream.pipe(fileStream);
        objStream.write(record.searchable);
        objStream.end();

        await endstreams;
    }

    public async forEachPrefix<T>(
        fn: (index: IndexRecordSet) => Promise<T>,
        maxParallelJobs: number): Promise<T[]> {
        return await this.batchForEach(
            Array.from(this.indexDefinitions.values()),
            async (sample) => await this.loadBySample(sample).then(fn),
            maxParallelJobs);
    }

    public async load(safeKey: indexModel.recordSafeKey): Promise<IndexRecordSet> {
        const sampleRecord = this.indexDefinitions.get(safeKey);
        if (typeof sampleRecord === "undefined") {
            throw new Error("The requested key was not found in this index: " + safeKey);
        }
        return await this.loadBySample(sampleRecord);
    }

    public async loadBySample(sampleRecord: IndexRecord): Promise<IndexRecordSet> {
        const indexUri = await this.getContainerFileName(sampleRecord);
        return await this.loadRecordSet(sampleRecord.safekey, sampleRecord.maxShards, indexUri);
    }

    public async loadRecordSet(safekey: indexModel.recordSafeKey,
                               maxShards: number,
                               indexUri: fs.PathLike): Promise<IndexRecordSet> {

        const fileReader = fs.createReadStream(indexUri);

        const container = new IndexRecordSet(safekey);
        const objectComposer = new ostream.BytesToEntityTransformStream();
        objectComposer.debugnote = indexUri.toString();

        objectComposer.on("readable", () => {
            let item: ISearchable;
            // tslint:disable-next-line: no-conditional-assignment
            while ((item = objectComposer.read()) != null) {
                container.push(new IndexRecord(item, maxShards));
            }
        });

        const endstreams = (async () => /*await*/ new Promise<IndexRecordSet>((resolve, reject) => {
            fileReader.on("error", (serr) => {
                objectComposer.destroy();
                reject(serr);
            });
            objectComposer.on("error", (serr) => reject(serr));
            objectComposer.on("end", () => {
                // all data has been output, which occurs after the callback in transform._flush() has been called
                if (container.length === 0) {
                    if (container.length === 0) {
                        reject(new Error("No elements read for " + indexUri));
                    }
                    if (objectComposer.hasBuffer === true) {
                        reject(new Error(`Stream finished at ${objectComposer.position} ` +
                            `with more to read from buffer ${indexUri}`));
                    }
                } else {
                    resolve(container); // if I don't resolve in fileReader.close, it keeps crashing.
                }
            });
        }))();

        fileReader.pipe(objectComposer);

        return await endstreams;
    }

    private async getContainerFileName(record: IndexRecord, createDir: boolean = false): Promise<string> {
        const shardUri = path.join(this.rootPath, record.shard);
        const pageUri = path.join(shardUri, record.getPageName(0));
        if (!createDir) {
            return Promise.resolve(pageUri);
        } else {
            return new Promise((resolve, reject) => {
                fs.mkdir(shardUri, (err) => {
                    if (err && err.code !== "EEXIST") {
                        reject(err);
                    } else {
                        resolve(pageUri);
                    }
                });
            });
        }
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

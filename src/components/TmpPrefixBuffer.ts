import fs from "fs";
import os from "os";
import path from "path";
import uuidv4 from "uuid/v4";

import * as ostream from "../index/ObjectStreams";
import BasePrefixBuffer, { IndexRecordSet } from "../index/PrefixBuffer";

import IndexRecord from "../common/IndexRecord";
import * as indexModel from "../common/IndexRecord";
import ISearchable from "../common/ISearchable";

export default class TmpPrefixBuffer extends BasePrefixBuffer {
    public readonly indexDefinitions: Map<string, IndexRecord> = new Map();
    private rootPath: string;

    constructor() {
        super();
        this.rootPath = getTempDirSync();
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

function getTempDirSync(): string {
    const tempDirPath = path.join(os.tmpdir(), uuidv4());
    fs.mkdirSync(tempDirPath);
    return tempDirPath;
}


import fs from "fs";
import path from "path";

import * as ostream from "./ObjectStreams";

import IIndexEntry from "./model/IIndexEntry";
import * as Utils from "./Utils";

export abstract class BasePrefixBuffer {
    public abstract add(key: string, entry: IIndexEntry): Promise<void>;
    public abstract load(key: string): Promise<IndexEntryContainer>;
    public abstract forEachPrefix<T>(fn: (prefix: string, entries: IndexEntryContainer) => Promise<T>):
        IterableIterator<Promise<T>>;

    protected safeKey(key: string): string {
        // we cannot use indexEntry.value directly as it contains natural data
        // and js array/dictionary indexers are not from the natural domain
        // being very flexible, they still have their limitations, e.g. such words as
        // 'constructor' or 'toString' can disbehave
        return Buffer.from(key).toString("base64");
    }
}

// tslint:disable-next-line: max-classes-per-file
export class RamPrefixBuffer extends BasePrefixBuffer {
    private indexDefinitions: { [prefix: string]: IndexEntryContainer; } = { };

    public add(key: string, entry: IIndexEntry): Promise<void> {
        const container = this.getEntryContainer(key);
        container.push(entry);
        return Promise.resolve();
    }

    public load(key: string): Promise<IndexEntryContainer> {
        return Promise.resolve(this.getEntryContainer(key));
    }

    public * forEachPrefix<T>(fn: (prefix: string, entries: IndexEntryContainer) => Promise<T>):
        IterableIterator<Promise<T>> {
        for (const pair of Object.entries(this.indexDefinitions)) {
            yield fn(pair[0], pair[1]);
        }
    }

    private getEntryContainer(key: string): IndexEntryContainer {
        const safeKey = this.safeKey(key);
        const definition = safeKey in this.indexDefinitions
            ? this.indexDefinitions[safeKey]
            : (this.indexDefinitions[safeKey] = new IndexEntryContainer(key));
        return definition;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class LocalFilePrefixBuilder extends BasePrefixBuffer {
    private indexDefinitions: { [prefix: string]: string; } = { };
    private rootPath: string;
    private maxShards: number;

    constructor(rootPath: string, maxShards: number) {
        super();
        this.rootPath = rootPath;
        this.maxShards = maxShards;
    }

    public add(key: string, entry: IIndexEntry): Promise<void> {
        return new Promise((resolve, reject) => {
            const containerFileName = this.getContainerFileName(key);
            fs.mkdir(path.dirname(containerFileName), { recursive: true }, (fserr) => {
                if (fserr) {
                    reject(fserr);
                }
                console.log("Creating write stream...", key, containerFileName);
                const stream = fs.createWriteStream(containerFileName, { flags: "a" });
                stream.on("close", () => {
                    this.addEntryContainer(key);
                    resolve();
                });
                stream.on("error", (serr) => reject(serr));

                const writeStream = new ostream.EntityToBytesTransformStream();
                writeStream.pipe(stream);
                writeStream.write(entry);
                writeStream.end();

                stream.end();
            });
        });
    }

    public load(key: string): Promise<IndexEntryContainer> {
        return new Promise((resolve, reject) => {
            const containerFileName = this.getContainerFileName(key);
            console.log("Loading container", key, containerFileName);

            const readStream = new ostream.BytesToEntityTransformStream();

            const stream = fs.createReadStream(containerFileName);
            stream.on("close", () => resolve(container));
            stream.on("error", (err) => reject(err));
            stream.pipe(readStream);

            const container = new IndexEntryContainer(key);
            let item: IIndexEntry;
            readStream.on("readable", () => {
                // tslint:disable-next-line: no-conditional-assignment
                while ((item = readStream.read()) != null) {
                    console.log("Item read into container", item);
                    container.push(item);
                }
                stream.close();
            });
        });
    }

    public * forEachPrefix<T>(fn: (prefix: string, entries: IndexEntryContainer) => Promise<T>):
        IterableIterator<Promise<T>> {
        for (const pair of Object.entries(this.indexDefinitions)) {
            yield this.load(pair[1]).then((container) => fn(pair[1], container));
        }
    }

    private getContainerFileName(key: string): string {
        return path.join(this.rootPath, Utils.fileKey(0, key, this.maxShards));
    }

    private addEntryContainer(key: string): void {
        const safeKey = this.safeKey(key);
        if (!(safeKey in this.indexDefinitions)) {
            this.indexDefinitions[safeKey] = key;
        }
    }
}

// tslint:disable-next-line: max-classes-per-file
export class IndexEntryContainer extends Array<IIndexEntry> {
    public indexKey: string;

    constructor(indexKey: string) {
        super();
        this.indexKey = indexKey;
    }
}

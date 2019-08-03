import IIndexEntry from "./model/IIndexEntry";

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
export class IndexEntryContainer extends Array<IIndexEntry> {
    public indexKey: string;

    constructor(indexKey: string) {
        super();
        this.indexKey = indexKey;
    }
}

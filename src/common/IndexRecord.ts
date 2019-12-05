import ISearchable from "./ISearchable";

export default class IndexRecord {
    public static createFromSearchQuery(query: string, maxShards: number): IndexRecord {
        return new IndexRecord({
            docId: query,
            fields: [],
            value: query, // cleanup?..
            weight: 1,
        }, maxShards);
    }

    public readonly key: recordKey;
    public readonly shard: recordShard;
    public readonly safekey: recordSafeKey;
    public readonly sha256: recordSha256;
    public readonly searchable: ISearchable;
    public readonly maxShards: number;

    constructor(searchable: ISearchable, maxShards: number) {
        this.searchable = searchable;
        this.key = searchable.value;
        this.sha256 = stringHash(this.key);
        this.safekey = safeKey(this.key, this.sha256);
        this.maxShards = maxShards;
        this.shard = (this.sha256 % maxShards).toString(36);
    }

    public getPageName(pageNum: number): string {
        return `${this.safekey}-${pageNum}.json`;
    }

    public getPageUri(pageNum: number): string {
        return `${this.shard}/${this.getPageName(pageNum)}`;
    }
}

/**
 * The natural language prefix of the word, including any type of characters.
 */
export type recordKey = string;
/**
 * A save key is a key that can be used in file names, JS dictionary keys, URLs, etc.
 * May be based on the recordKey, may include the Sha256.
 */
export type recordSafeKey = string;
/**
 * Sha256 is an integer hash code of the recordKey.
 */
export type recordSha256 = number;
/**
 * An integer hash code of the recordKey.
 */
export type recordHashCode = number;
/**
 * Shard name for this record. Based on the required number of shards.
 */
export type recordShard = string;

// function sha256hash(arg: string): recordSha256 {
//     const hasher = crypto.createHash("sha256");
//     const digest = hasher.update(arg).digest();
//     let offset = 0;
//     let hash = 0;
//     while (offset < digest.byteLength) {
//         // tslint:disable-next-line:no-bitwise
//         hash ^= (isLittleEndian ? digest.readInt32LE(offset) : digest.readInt32BE(offset));
//         offset += 32 / 8;
//     }
//     return Math.abs(hash);
// }

function stringHash(arg: string): recordHashCode {
    let hash = 0;
    if (arg.length === 0) { return hash; }
    for (let i = 0; i < arg.length; i++) {
      // tslint:disable-next-line: no-bitwise
      hash = ((hash << 5) - hash) + arg.charCodeAt(i);
      // tslint:disable-next-line: no-bitwise
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function safeKey(key: recordKey, sha256: recordSha256): recordSafeKey {
    return sha256.toString(36) + key.replace(/[\W]*/gi, "");
}

// let isLittleEndian = true;

// tslint:disable-next-line:max-line-length
// https://riptutorial.com/javascript/example/13317/little---big-endian-for-typed-arrays-when-using-bitwise-operators
// (() => {
//     const buf = new ArrayBuffer(4);
//     const buf8 = new Uint8ClampedArray(buf);
//     const data = new Uint32Array(buf);
//     data[0] = 0x0F000000;
//     isLittleEndian = buf8[0] !== 0x0f;
// })();

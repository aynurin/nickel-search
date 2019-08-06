
import crypto from "crypto";
import fs from "fs";

import IDataStore from "./components/IDataStore";

import FileStore from "./FileStore";
import S3Store from "./S3Store";

import ICreateStoreOptions from "./model/ICreateStoreOptions";

let isLittleEndian = true;

(() => {
    // tslint:disable-next-line:max-line-length
    // https://riptutorial.com/javascript/example/13317/little---big-endian-for-typed-arrays-when-using-bitwise-operators
    const buf = new ArrayBuffer(4);
    const buf8 = new Uint8ClampedArray(buf);
    const data = new Uint32Array(buf);
    data[0] = 0x0F000000;
    isLittleEndian = buf8[0] !== 0x0f;
})();

export function shardName(arg: string, maxShards: number): string {
    const hasher = crypto.createHash("sha256");
    const digest = hasher.update(arg).digest();
    let offset = 0;
    let hash = 0;
    while (offset < digest.byteLength) {
        // tslint:disable-next-line:no-bitwise
        hash ^= (isLittleEndian ? digest.readInt32LE(offset) : digest.readInt32BE(offset));
        offset += 32 / 8;
    }
    return (Math.abs(hash) % maxShards).toString(36);
}

export function fileKey(pageNum: number, key: string, maxShards: number) {
    return shardName(key, maxShards) + "/" + Buffer.from(key).toString("base64") + "-" + pageNum + ".json";
}

export function createStore<TDoc>(options: ICreateStoreOptions):
    IDataStore<TDoc> | null {
    if (options && options.location && typeof options.location === "string") {
        const s3Options = S3Store.parseOptions(options); // { bucket: location, awsCredentials: options.credentials }
        if (s3Options != null) {
            return new S3Store<TDoc>(s3Options);
        }
        const filestoreOptions = FileStore.parseOptions(options);
        if (filestoreOptions != null) {
            return new FileStore<TDoc>(filestoreOptions);
        }
    }
    return null;
}

export function mkdirsSync(path: fs.PathLike, options?: string | number | fs.MakeDirectoryOptions | null | undefined) {
    try {
        fs.mkdirSync(path, options);
    } catch (err) {
        if (err.code !== "EEXIST") {
            throw err;
        }
    }
}

export function memusage() {
    const used = process.memoryUsage();
    console.debug(`MEM (${process.pid}):`,
        mem("ext", used.external),
        mem("het", used.heapTotal),
        mem("heu", used.heapUsed),
        mem("rss", used.rss));
}

function mem(title: string, val: number): string {
    return `${title} ${(Math.round(val / 1024 / 1024 * 100) / 100)} MB`.padEnd(8 + title.length, " ");
}

// https://stackoverflow.com/questions/8482309/converting-javascript-integer-to-byte-array-and-back
export function longToByteArray(long: number): Uint8Array {
    // we want to represent the input as a 8-bytes array
    const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

    for (let index = 0; index < byteArray.length; index++ ) {
        // tslint:disable-next-line: no-bitwise
        const byte = long & 0xff;
        byteArray[index] = byte;
        long = (long - byte) / 256;
    }

    return new Uint8Array(byteArray);
}

export function byteArrayToLong(byteArray: Uint8Array): number {
    let value = 0;
    for (let i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }

    return value;
};
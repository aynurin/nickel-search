import crypto from "crypto";

import IDataStore from "./components/IDataStore";

import FileStore from "./FileStore";
import S3Store from "./S3Store";

let isLE = true;

(() => {
    // tslint:disable-next-line:max-line-length
    // https://riptutorial.com/javascript/example/13317/little---big-endian-for-typed-arrays-when-using-bitwise-operators
    const buf = new ArrayBuffer(4);
    const buf8 = new Uint8ClampedArray(buf);
    const data = new Uint32Array(buf);
    data[0] = 0x0F000000;
    isLE = buf8[0] !== 0x0f;
})();

export function shardName(arg: string, maxShards: number): string {
    const hasher = crypto.createHash("sha256");
    const digest = hasher.update(arg).digest();
    let offset = 0;
    let hash = 0;
    while (offset < digest.byteLength) {
        // tslint:disable-next-line:no-bitwise
        hash ^= (isLE ? digest.readInt32LE(offset) : digest.readInt32BE(offset));
        offset += 32 / 8;
    }
    return (Math.abs(hash) % maxShards).toString(36);
}

export function fileKey(pageNum: number, key: string, maxShards: number) {
    return shardName(key, maxShards) + "/" + Buffer.from(key).toString("base64") + "-" + pageNum + ".json";
}

export function createStore<TDoc>(options: any): IDataStore<TDoc> | null {
    if (options && options.location && typeof options.location === "string") {
        let location = S3Store.parseLocation(options.location);
        if (location != null) {
            return new S3Store<TDoc>({ bucket: location, ...options });
        } else {
            location = FileStore.parseLocation(options.location);
            if (location != null) {
                return new FileStore<TDoc>({ dir: location });
            }
        }
    }
    return null;
}

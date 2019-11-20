
import fs from "fs";
import * as uuid from "node-uuid";
import os from "os";
import path from "path";
import rimraf from "rimraf";

export type MkdirsSyncOptions = string | number | fs.MakeDirectoryOptions | null | undefined;

export function mkdirsSync(dirPath: fs.PathLike, options?: MkdirsSyncOptions) {
    try {
        fs.mkdirSync(dirPath, options);
    } catch (err) {
        if (err.code !== "EEXIST") {
            throw err;
        }
    }
}

export interface IDisposable {
    dispose(): Promise<void>;
}

export class TempDir implements IDisposable {
    public path: string;

    constructor() {
        this.path = path.join(os.tmpdir(), uuid.v4() + "/");
        mkdirsSync(this.path);
    }

    public toString() {
        return this.path;
    }

    public async dispose(): Promise<void> {
        // return Promise.resolve();
        return new Promise((resolve, reject) => {
            rimraf(this.path, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

}

export async function using(obj: IDisposable, body: (obj: any) => Promise<void>): Promise<void> {
    const context = obj;
    try {
        await body(obj);
    } finally {
        await obj.dispose();
    }
}

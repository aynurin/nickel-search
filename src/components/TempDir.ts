import * as uuid from "node-uuid";
import os from "os";
import path from "path";
import rimraf from "rimraf";
import { mkdirsSync } from "./FSUtils";
import IDisposable from "./IDisposable";

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

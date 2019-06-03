import walk from "dir-walker-gen";
import _fs from "fs";
import path from "path";
import { promisify } from "util";

import IDataStore from "./components/IDataStore";

const fs = {
    mkdir: promisify(_fs.mkdir),
    readFile: promisify(_fs.readFile),
    stat: promisify(_fs.stat),
    writeFile: promisify(_fs.writeFile),
};

export default class FileStore<TDoc> implements IDataStore<TDoc> {
    public static parseLocation(location: string): string | null {
        try {
            const stats = _fs.statSync(location);
            if (stats.isDirectory()) {
                return location;
            }
        } catch {
            // no-op
        }
        return null;
    }

    private rootDir: string;

    constructor(options: { dir: string }) {
        this.rootDir = options.dir;
    }

    public async * readNext(): AsyncIterableIterator<{key: string, document: TDoc}> {
        const options = {
            folders: [this.rootDir],
        };

        for (const file of walk(options)) {
            yield {
                document: await this.readItem(file),
                key: file,
            };
        }
    }

    public async readItem(key: string): Promise<TDoc> {
        let fullPath = key;
        try {
            await fs.stat(fullPath);
        } catch {
            fullPath = path.join(this.rootDir, key);
        }
        try {
            const data = await fs.readFile(fullPath, {encoding: "utf8"});
            if (data) {
                return JSON.parse(data);
            } else {
                throw new Error(`Item is empty at ${fullPath}`);
            }
        } catch (e) {
            if (e.code !== "ENOENT") {
                throw e;
            } else {
                throw new Error(`Item is empty at ${fullPath}`);
            }
        }
    }

    public async write(key: string, item: TDoc): Promise<void> {
        const fullPath = path.join(this.rootDir, key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(item));
    }
}

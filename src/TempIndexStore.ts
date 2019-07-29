
import { fileKey, mkdirsSync } from "./Utils";

import fs from "fs";
import path from "path";
import { promisify } from "util";

const fsAsync = {
    readFile: promisify(fs.readFile),
    writeFile: promisify(fs.writeFile),
};

/**
 * Temporary storage for index pages.
 * Implemented to reduce memory requirements by storing index files on disk during indexing.
 */
export default class TempIndexStore {
    private tempLocation: string;
    private indexShards: number;
    private saveThreshold: number;

    constructor(indexShards: number, saveThreshold: number, tempLocation: string) {
        this.tempLocation = tempLocation;
        this.indexShards = indexShards;
        this.saveThreshold = saveThreshold;
        mkdirsSync(this.tempLocation);
    }

    public isThresholdReached(processedCount: number): boolean {
        return processedCount >= this.saveThreshold;
    }

    public async saveTemp(indexKey: string, pageNum: number, entries: any) {
        const fileName = fileKey(pageNum, indexKey, this.indexShards);
        const filePath = path.join(this.tempLocation, fileName);
        mkdirsSync(path.dirname(filePath));
        await fsAsync.writeFile(filePath, JSON.stringify({
            entries, indexKey, pageNum}));
    }

    public async loadTemp(indexKey: string, pageNum: number): Promise<any[]> {
        const fileName = fileKey(pageNum, indexKey, this.indexShards);
        const filePath = path.join(this.tempLocation, fileName);
        const buffer = await fsAsync.readFile(filePath);
        const data = JSON.parse(buffer.toString());
        return data.entries;
    }
}

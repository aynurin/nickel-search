
import fs from "fs";

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

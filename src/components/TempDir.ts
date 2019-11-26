import uuidv4 from "uuid/v4";

export async function getTempDir(): Promise<string> {
    const os = await import("os");
    const path = await import("path");
    const fs = await import("fs");
    const tempDirPath = path.join(os.tmpdir(), uuidv4());
    await new Promise((resolve, reject) => {
        fs.mkdir(tempDirPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
    return tempDirPath;
}

export default async function withTempDir(handler: (tempDirPath: string) => PromiseLike<any>|any) {
    const tempDirPath = await getTempDir();
    const output = handler(tempDirPath);
    if (typeof output.then === "function") {
        await output;
    }
    const rimraf = (await import("rimraf")).default;
    return new Promise((resolve, reject) => {
        rimraf(tempDirPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(output);
            }
        });
    });
}

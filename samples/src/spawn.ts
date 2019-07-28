import child_process from "child_process";
import path from "path";

export default async function spawn(command: string, args: string[],
                                    options?: child_process.SpawnOptions): Promise<number> {
    console.debug(command, args.join(" "));
    return new Promise((resolve, reject) => {
        options = Object.assign({
            cwd: path.join(path.dirname(__filename), "../.."),
            shell: false,
            stdio: "inherit",
        }, options);
        const subproc = child_process.spawn(command, args, options);
        subproc.on("error", (err) => {
            reject(err);
        });
        subproc.on("close", (code: number) => {
            if (code === 0) {
                resolve();
            } else {
                reject(code);
            }
        });
    });
}
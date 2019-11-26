export default interface IDisposable {
    dispose(): Promise<void>;
}

export async function using(obj: IDisposable, body: (obj: any) => Promise<void>): Promise<void> {
    try {
        await body(obj);
    } finally {
        await obj.dispose();
    }
}

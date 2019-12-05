export default class EntryNotFoundError extends Error {
    constructor(fileName: string) {
        super(`Entry not found for ${fileName}`);
        Object.setPrototypeOf(this, EntryNotFoundError.prototype);
    }
}

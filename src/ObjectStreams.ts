import * as stream from "stream";
import * as utils from "./Utils";

type Encoding = "base64" | "ascii" | "utf8" | "utf-8" | "utf16le" |
                "ucs2" | "ucs-2" | "latin1" | "binary" | "hex" | undefined;

export class WritableStream<T> extends stream.Writable {
    private underlyingStream: stream.Writable;
    constructor(underlyingStream: stream.Writable, options?: stream.WritableOptions) {
        super(Object.assign(options ? options : {}, { objectMode: true }));
        this.underlyingStream = underlyingStream;
    }

    public _write(chunk: T, encoding: string, callback: (error: Error | null | undefined) => void) {
        let callbackExecuted = false;
        const cb = (err?: Error | null | undefined) => {
            if (callbackExecuted === false) {
                callback(err);
                callbackExecuted = true;
            }
        }

        const dataBuffer = Buffer.from(JSON.stringify(chunk), encoding as Encoding);
        const dataLength = Buffer.from(utils.longToByteArray(dataBuffer.length));
        if (dataLength.length !== 8) {
            cb(Error(`Expected data length section length is 8, received ${dataLength.length}: ` +
                dataLength.toString("hex")));
        }
        if (this.underlyingStream.write(dataLength)) {
            const written = this.underlyingStream.write(dataBuffer, "binary", cb);
            cb();
            return written;
        } else {
            cb(Error(
                "Could not write object length." +
                `Requested: ${dataBuffer.length}, ` +
                `Writable length: ${this.underlyingStream.writableLength}`));
            return false;
        }
    }
}

// tslint:disable-next-line: max-classes-per-file
export class ReadableStream<T> extends stream.Readable {
    private underlyingStream: stream.Readable;
    private totalReadFromUnderlyingStream: number;

    constructor(underlyingStream: stream.Readable, options?: stream.ReadableOptions) {
        super(Object.assign(options ? options : {}, { objectMode: true }));
        this.underlyingStream = underlyingStream;
        this.totalReadFromUnderlyingStream = 0;
    }

    public _read(size: number): void {
        this.underlyingStream.on("readable", () => {
            if (size == null) {
                size = 10;
            }
            let readMore = true;
            while (readMore && size > 0) {
                readMore = false;
                const itemLengthBuffer = this.underlyingStream.read(8) as Buffer | null;
                if (itemLengthBuffer == null) {
                    break; // no more data to read
                }
                this.totalReadFromUnderlyingStream += 8;
                const requestedLength = utils.byteArrayToLong(itemLengthBuffer);
                let dataLength = requestedLength;
                let dataBuffer = Buffer.alloc(0);
                while (dataLength > 0) {
                    const currentBuffer = this.underlyingStream.read(dataLength) as Buffer | null;
                    if (currentBuffer !== null) {
                        this.totalReadFromUnderlyingStream += currentBuffer.length;
                    }
                    if (currentBuffer !== null && currentBuffer.length > 0 && currentBuffer.length <= dataLength) {
                        dataLength -= currentBuffer.length;
                        dataBuffer = Buffer.concat([dataBuffer, currentBuffer]);
                    } else {
                        const msg1 = "Unexpected condition. ";
                        const msg2 = currentBuffer == null
                                ? "Underlying stream returned no data after returning data length. "
                            : currentBuffer.length === 0
                                ? "Underlying stream returned empty buffer. "
                            : currentBuffer.length > dataLength
                                ? "Underlying stream returned more data than requested. "
                            : "";
                        process.nextTick(() => this.emit("error", Error(
                            msg1 + msg2 +
                            `Requested: ${dataLength}, ` +
                            `Returned: ${currentBuffer ? currentBuffer.length : "null"}, ` +
                            `Position: ${this.totalReadFromUnderlyingStream}`)));
                        break;
                    }
                }
                if (dataBuffer.length !== requestedLength) {
                    process.nextTick(() => this.emit("error", Error(
                                "Unexpected condition. " +
                                "Buffer length does not match requested length. " +
                                `Requested: ${dataLength}, ` +
                                `Buffer length: ${dataBuffer.length}, ` +
                                `Position: ${this.totalReadFromUnderlyingStream}`)));
                }
                if (dataBuffer.length > 0) {
                    const obj = JSON.parse(dataBuffer.toString()) as T;
                    readMore = this.push(obj);
                    size--;
                }
            }
        });
    }
}

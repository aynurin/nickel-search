import * as stream from "stream";
import { StringDecoder } from "string_decoder";

type Encoding = "base64" | "ascii" | "utf8" | "utf-8" | "utf16le" |
    "ucs2" | "ucs-2" | "latin1" | "binary" | "hex" | undefined;

/**
 * Transforms entities into bytes. Writable is JS Objects, readable is bytes.
 */
// tslint:disable-next-line: max-classes-per-file
export class EntityToBytesTransformStream extends stream.Transform {
    constructor(options?: stream.TransformOptions) {
        super(Object.assign(options ? options : {}, { writableObjectMode: true }));
    }

    public _transform(chunk: any, encoding: string, callback: (err: any) => void) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(JSON.stringify(chunk));
        const data = Buffer.alloc(8 + buffer.length);

        data.writeDoubleBE(buffer.length, 0);
        buffer.copy(data, 8, 0);

        this.push(data);
        callback(null);
    }
}

/**
 * Transforms bytes into entities. Writable is bytes, readable is JS Objects.
 */
// tslint:disable-next-line: max-classes-per-file
export class BytesToEntityTransformStream extends stream.Transform {
    public debugnote: string = "";
    public hasBuffer: boolean = false;
    public position: number;

    private currentBuffer: Buffer;
    private countRead: number = 0;

    constructor(options?: stream.TransformOptions) {
        super(Object.assign(options ? options : {}, { readableObjectMode: true }));
        this.currentBuffer = Buffer.alloc(0);
        this.position = 0;
    }

    public _transform(chunk: any, encoding: string, callback: (err: any) => void): void {
        this.currentBuffer = Buffer.concat([this.currentBuffer, chunk]);
        if (this.currentBuffer.length > 0) {
            this.hasBuffer = true;
        }
        let item: any;
        do {
            item = this.tryReadItem();
            if (item !== null) {
                this.push(item);
                this.countRead++;
            }
        } while (item);
        callback(null);
    }

    public _final(callback: () => void) {
        let item: any;
        do {
            item = this.tryReadItem();
            if (item) {
                this.push(item);
                this.countRead++;
            }
        } while (item);
        callback();
    }

    private tryReadItem(): any {
        if (this.currentBuffer.length < 8) {
            if (this.currentBuffer.length > 0) {
                this.hasBuffer = true;
            }
            return null;
        }

        const length = this.currentBuffer.readDoubleBE(this.position);
        const startAt = this.position + 8;
        if (this.currentBuffer.length < startAt + length) {
            this.hasBuffer = true;
            // not enough data to read
            return null;
        }
        // extract value
        const buffer = Buffer.alloc(length);
        this.currentBuffer.copy(buffer, 0, startAt, startAt + length);

        // remove used bytes from buffer
        const nextStart = startAt + length;
        const newBuffer = Buffer.alloc(this.currentBuffer.length - nextStart);
        this.currentBuffer.copy(newBuffer, 0, nextStart, this.currentBuffer.length);
        this.currentBuffer = newBuffer;
        this.position = 0;

        if (this.currentBuffer.length === 0) {
            this.hasBuffer = false;
        }

        const result = JSON.parse(buffer.toString());

        return result;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class MemoryDuplexStream extends stream.Duplex {
    private buffer: Buffer;
    private position: number;
    private length: number;
    private writePosition: number;

    constructor(options?: stream.DuplexOptions | undefined) {
        super(options);
        this.buffer = Buffer.alloc(1024);
        this.position = 0;
        this.length = 0;
        this.writePosition = 0;
    }

    public _write(chunk: any, encoding: string, callback: (err: any) => void): void {
        const chunkBuffer = Buffer.from(chunk);
        this.alloc(this.writePosition + chunkBuffer.length);
        chunkBuffer.copy(this.buffer, this.writePosition);
        this.writePosition = this.writePosition + chunkBuffer.length;
        if (this.length < this.writePosition) {
            this.length = this.writePosition;
        }
        callback(null);
    }

    public _read(size: number): void {
        let chunkEnd = this.position + size;
        if (chunkEnd > this.length) {
            chunkEnd = this.length;
        }
        const chunkLength = chunkEnd - this.position;
        if (chunkLength > 0) {
            const readBuffer = Buffer.alloc(chunkLength);
            this.buffer.copy(readBuffer, 0, this.position, chunkEnd);
            this.push(readBuffer);
            this.position += chunkLength;
        }
    }

    public getBuffer(start?: number, end?: number): Buffer {
        if (!start) {
            start = 0;
        }
        if (!end) {
            end = this.length;
        }
        const buff = Buffer.alloc(end - start);
        this.buffer.copy(buff, 0, start, end);
        return buff;
    }

    public getString(encoding: Encoding = "utf8", start?: number, end?: number): string {
        const buffer = this.getBuffer(start, end);
        const decoder = new StringDecoder(encoding);
        const str = decoder.write(buffer);

        decoder.end();

        return str;
    }

    private alloc(newLength: number): void {
        if (this.buffer.length >= newLength) {
            return;
        }
        let newSize = this.buffer.length * 2;
        if (newSize < newLength) {
            newSize = newLength;
        }
        const newBuffer = Buffer.alloc(newSize);
        this.buffer.copy(newBuffer, 0);
        this.buffer = newBuffer;
    }
}

/*
 * Notes:
 * readable.end =>    when there is no more data to be consumed from the stream
 * readable.close =>  when the stream and any of its underlying resources have been closed
 * writable.finish => after stream.end() is called and all chunks have been processed by stream._transform()
 * writable.end =>    all data has been output, which occurs after the callback in transform._flush() has been called.
 *                    _flush will be called when there is no more written data to be consumed, but before the 'end'
 *                    event is emitted signaling the end of the Readable stream.
 */

import * as stream from "stream";

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
    private currentBuffer: Buffer;
    private position: number;

    constructor(options?: stream.TransformOptions) {
        super(Object.assign(options ? options : {}, { readableObjectMode: true }));
        this.currentBuffer = Buffer.alloc(0);
        this.position = 0;
    }

    public _transform(chunk: any, encoding: string, callback: (err: any) => void): void {
        this.currentBuffer = Buffer.concat([this.currentBuffer, chunk]);
        let item: any;
        let countRead = 0;
        do {
            item = this.tryReadItem();
            if (item) {
                this.push(item);
                countRead++;
            }
        } while (item);
        if (countRead > 0) {
            callback(null);
        }
    }

    private tryReadItem(): any {
        if (this.currentBuffer.length < 8) {
            return null;
        }
        const length = this.currentBuffer.readDoubleBE(this.position);
        const startAt = this.position + 8;
        if (this.currentBuffer.length < startAt + length) {
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

        return JSON.parse(buffer.toString());
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

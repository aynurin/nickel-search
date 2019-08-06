import * as mem from "memory-streams";
import * as ostream from "../ObjectStreams";

interface ITestObject {
    some: string;
    token: number;
}

it("can write one object", () => {
    const original: ITestObject = {
        some: "fancy",
        token: 42,
    };
    const writeMemoryStream = new mem.WritableStream();
    const testedWriteStream = new ostream.WritableStream<ITestObject>(writeMemoryStream);
    testedWriteStream.write(original);
    testedWriteStream.end();
    writeMemoryStream.end();

    const writtenData = writeMemoryStream.toBuffer();
    expect(writtenData.length).toEqual(35);
});

it("can write into memory stream", () => {
    const writeMemoryStream = new mem.WritableStream();
    writeMemoryStream.write("Hello ");
    writeMemoryStream.write("World!");
    writeMemoryStream.end();

    const writtenData = writeMemoryStream.toBuffer();
    expect(writtenData.length).toEqual(12);
});

it("can write two objects", () => {
    const a: ITestObject = {
        some: "alpha",
        token: 2,
    };
    const b: ITestObject = {
        some: "beta",
        token: 33,
    };
    const writeMemoryStream = new mem.WritableStream();
    const testedWriteStream = new ostream.WritableStream<ITestObject>(writeMemoryStream);
    testedWriteStream.write(a);
    testedWriteStream.write(b);
    testedWriteStream.end();
    writeMemoryStream.end();

    const writtenData = writeMemoryStream.toBuffer();
    expect(writtenData.length).toEqual(68);
});

it("can write and read one object", (done) => {
    const original: ITestObject = {
        some: "fancy",
        token: 42,
    };
    const writeMemoryStream = new mem.WritableStream();
    const testedWriteStream = new ostream.WritableStream<ITestObject>(writeMemoryStream);
    testedWriteStream.write(original);
    testedWriteStream.end();

    const readMemoryStream = new mem.ReadableStream(writeMemoryStream.toString());
    writeMemoryStream.end();

    const testedReadStream = new ostream.ReadableStream<ITestObject>(readMemoryStream);
    testedReadStream.on("readable", () => {
        const data = testedReadStream.read();
        expect(data).toEqual(original);
        done();
    });
});

it("can write and read three objects", (done) => {
    const a: ITestObject = {
        some: "alpha",
        token: 2,
    };
    const b: ITestObject = {
        some: "beta",
        token: 33,
    };
    const c: ITestObject = {
        some: "gamma",
        token: 444,
    };
    const writeMemoryStream = new mem.WritableStream();
    const testedWriteStream = new ostream.WritableStream<ITestObject>(writeMemoryStream);
    testedWriteStream.write(a);
    testedWriteStream.write(b);
    testedWriteStream.write(c);
    testedWriteStream.end();

    const readMemoryStream = new mem.ReadableStream(writeMemoryStream.toString());
    writeMemoryStream.end();

    const testedReadStream = new ostream.ReadableStream<ITestObject>(readMemoryStream);
    testedReadStream.on("readable", () => {
        const ra = testedReadStream.read();
        const rb = testedReadStream.read();
        const rc = testedReadStream.read();
        expect(ra).toEqual(a);
        expect(rb).toEqual(b);
        expect(rc).toEqual(c);
        done();
    });
});

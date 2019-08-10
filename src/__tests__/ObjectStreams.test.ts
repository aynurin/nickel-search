import fs from "fs";
import path from "path";
import * as ostream from "../ObjectStreams";

it("can write one object", () => {
    const original = {
        some: "fancy",
        token: 42,
    };
    const memStream = new ostream.MemoryDuplexStream();
    const entityStream = new ostream.EntityToBytesTransformStream();
    entityStream.pipe(memStream);

    entityStream.write(original);
    entityStream.end();
    memStream.end();

    const writtenData = memStream.getBuffer();
    expect(writtenData.length).toEqual(35);
});

it("can write into memory stream", () => {
    const memStream = new ostream.MemoryDuplexStream();
    memStream.write("Hello ");
    memStream.write("World!");
    memStream.end();

    const writtenData = memStream.getBuffer();
    expect(writtenData.length).toEqual(12);
});

it("can write much into memory stream", () => {
    const dataset1 = Buffer.from(Array.from(Array(1234).keys()));
    const dataset2 = Buffer.from(Array.from(Array(5678).keys()));
    const memStream = new ostream.MemoryDuplexStream();
    memStream.write(dataset1);
    memStream.write(dataset2);
    memStream.end();

    const writtenData = memStream.getBuffer();
    expect(writtenData.length).toEqual(1234 + 5678);
});

it("can read in chunks from memory stream", () => {
    const memStream = new ostream.MemoryDuplexStream();
    memStream.write("Hello ");
    memStream.write("World!");
    const data1 = memStream.read(6).toString();
    const data2 = memStream.read(6).toString();
    memStream.end();

    expect(data1).toEqual("Hello ");
    expect(data2).toEqual("World!");
});

it("can read from memory stream", (done) => {
    const memStream = new ostream.MemoryDuplexStream();
    memStream.write("Hello ");
    memStream.write("World!");

    memStream.on("readable", () => {
        expect(memStream.read().toString()).toEqual("Hello World!");
        done();
    });
});

// borrowed from https://github.com/doanythingfordethklok/memory-stream/
it("can stream file to memory", (done) => {
    const source = path.join(__dirname, "./ObjectStreams.source1.txt");
    const gold = fs.readFileSync(source);
    const rs = fs.createReadStream(source);
    const ws = new ostream.MemoryDuplexStream();

    ws.on("finish", () => {
        expect(ws.getBuffer()).toEqual(gold);
        done();
    });

    rs.pipe(ws);
});

it("can stream file into object reader", (done) => {
    const source = path.join(__dirname, "./ObjectStreams.source2.dat");

    const allItems = new Array<any>();

    const readStream = new ostream.BytesToEntityTransformStream();
    readStream.on("error", (err) => done(err));
    readStream.on("readable", () => {
        let item: any = null;
        // tslint:disable-next-line: no-conditional-assignment
        while ((item = readStream.read()) != null) {
            allItems.push(item);
        }
    });

    const fileStream = fs.createReadStream(source);
    fileStream.on("close", () => {
        expect(allItems).toHaveLength(4);
        done();
    });
    fileStream.on("error", (err) => done(err));
    fileStream.pipe(readStream);
});

it("can write two objects", () => {
    const a = {
        some: "eye",
        token: 2,
    };
    const b = {
        some: "consequent",
        token: 33,
    };
    const memStream = new ostream.MemoryDuplexStream();
    const entityStream = new ostream.EntityToBytesTransformStream();
    entityStream.pipe(memStream);

    entityStream.write(a);
    entityStream.write(b);
    entityStream.end();
    memStream.end();

    const writtenData = memStream.getBuffer();
    expect(writtenData.length).toEqual(72);
});

it("can write and read one object", (done) => {
    const original = {
        some: "fancy",
        token: 42,
    };
    const memStream = new ostream.MemoryDuplexStream();
    const entityStream = new ostream.EntityToBytesTransformStream();
    entityStream.pipe(memStream);

    entityStream.write(original);
    entityStream.end();

    const testedReadStream = new ostream.BytesToEntityTransformStream();
    memStream.pipe(testedReadStream);

    testedReadStream.on("readable", () => {
        const data = testedReadStream.read();
        expect(data).toEqual(original);
        done();
    });
});

it("can write and read three objects", (done) => {
    const a = {
        some: "alpha",
        token: 2,
    };
    const b = {
        some: "beta",
        token: 33,
    };
    const c = {
        some: "gamma",
        token: 444,
    };
    const memStream = new ostream.MemoryDuplexStream();
    const entityStream = new ostream.EntityToBytesTransformStream();
    entityStream.pipe(memStream);

    entityStream.write(a);
    entityStream.write(b);
    entityStream.write(c);
    entityStream.end();

    const testedReadStream = new ostream.BytesToEntityTransformStream();
    memStream.pipe(testedReadStream);

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

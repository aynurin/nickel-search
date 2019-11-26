
import { using } from "../components/IDisposable";
import { TempDir } from "../components/TempDir";
import IndexRecord from "../IndexRecord";
import * as builders from "../PrefixBuffer";

const sampleData = [{
    docs: ["1", "2", "3", "4", "5", "6", "7"],
    key: "ab",
}, {
    docs: ["8", "9", "10", "11", "12", "13", "14"],
    key: "ac",
}, {
    docs: ["14", "15", "16", "17", "18", "19"],
    key: "ad",
}];

function * getIndexRecords(): IterableIterator<IndexRecord> {
    for (const prefix of sampleData) {
        for (const doc of prefix.docs) {
            yield new IndexRecord({
                docId: doc,
                fields: [],
                value: prefix.key,
                weight: 1,
            }, 100);
        }
    }
}

async function downloadAllData(builder: builders.BasePrefixBuffer):
    Promise<builders.IndexRecordSet[]> {
    const allIndex: builders.IndexRecordSet[] = [];
    await builder.forEachPrefix((entries) => Promise.resolve(allIndex.push(entries)), 100);
    return allIndex;
}

async function canStorePrefixes(builder: builders.BasePrefixBuffer): Promise<void> {
    const indexRecords = Array.from(getIndexRecords());
    await Promise.all(indexRecords.map((idx) => builder.add(idx)));
    const ab = await builder.load(indexRecords[0].safekey);
    const docIds = ab.map((i) => i.searchable.docId) as string[];
    for (const item of ab) {
        expect(item.safekey).toEqual(ab.safeKey);
    }
    expect(ab.length).toEqual(7);
    for (const originalDocId of sampleData[0].docs) {
        expect(docIds).toContain(originalDocId);
    }
}

async function canListAllPrefixes(builder: builders.BasePrefixBuffer): Promise<void> {
    const indexRecords = Array.from(getIndexRecords());
    await Promise.all(indexRecords.map((idx) => builder.add(idx)));

    const received = await downloadAllData(builder);

    expect(received.length).toEqual(3);

    const recievedPrefixes = received.map((index) => index[0].key);
    for (const original of sampleData) {
        expect(recievedPrefixes).toContain(original.key);
        const docs = received.find((index) => index[0].key === original.key);
        expect(docs).toBeDefined();
        if (docs) {
            expect(docs.length).toEqual(original.docs.length);
            const prefixDocs = docs.map((e) => e.searchable.docId);
            for (const originalDoc of original.docs) {
                expect(prefixDocs).toContain(originalDoc);
            }
        }
    }}

it("can store prefixes in memory", async () => {
    const builder = new builders.RamPrefixBuffer();
    await canStorePrefixes(builder);
});

it("can list all prefixes from memory", async () => {
    const builder = new builders.RamPrefixBuffer();
    await canListAllPrefixes(builder);
});

it("can store prefixes in file", async () => {
    await using(new TempDir(), async (path) => {
        const builder = new builders.LocalFilePrefixBuilder(path.toString());
        await canStorePrefixes(builder);
    });
});

it("can list all prefixes from files", async () => {
    await using(new TempDir(), async (path) => {
        const builder = new builders.LocalFilePrefixBuilder(path.toString());
        await canListAllPrefixes(builder);
    });
});

import * as builders from "../PrefixBuffer";
import * as utils from "../Utils";

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

interface ITestedReceivedData { prefix: string; entries: builders.IndexEntryContainer; }

async function uploadSampleData(builder: builders.BasePrefixBuffer): Promise<void> {
    for (const prefix of sampleData) {
        for (const doc of prefix.docs) {
            await builder.add(prefix.key, {
                docId: doc,
                fields: [],
                value: prefix.key,
                weight: 1,
            });
        }
    }
}

async function downloadAllData(builder: builders.BasePrefixBuffer):
    Promise<ITestedReceivedData[]> {

    const iterator = builder.forEachPrefix((prefix, entries) => Promise.resolve({ prefix: entries[0].value, entries }));
    const waiters: Array<Promise<ITestedReceivedData>> = [];

    for (const item of iterator) {
        waiters.push(item);
    }

    return Promise.all(waiters);
}

async function canStorePrefixes(builder: builders.BasePrefixBuffer): Promise<void> {
    await uploadSampleData(builder);

    const originalPrefixes = sampleData;

    const ab = await builder.load("ab");
    const docIds = ab.map((i) => i.docId) as string[];
    expect(ab.indexKey).toEqual("ab");
    expect(ab.length).toEqual(7);
    for (const originalDocId of originalPrefixes[0].docs) {
        expect(docIds).toContain(originalDocId);
    }
}

async function canListAllPrefixes(builder: builders.BasePrefixBuffer): Promise<void> {
    await uploadSampleData(builder);

    const originalPrefixes = sampleData;

    const received = await downloadAllData(builder);

    expect(received.length).toEqual(3);

    const recievedPrefixes = received.map((r) => r.prefix);
    for (const original of originalPrefixes) {
        expect(recievedPrefixes).toContain(original.key);
        const docs = received.find((p) => p.prefix === original.key);
        expect(docs).toBeDefined();
        if (docs) {
            expect(docs.entries.length).toEqual(original.docs.length);
            const prefixDocs = docs.entries.map((e) => e.docId);
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
    await utils.using(new utils.TempDir(), async (path) => {
        const builder = new builders.LocalFilePrefixBuilder(path.toString(), 100);
        await canStorePrefixes(builder);
    });
});

it("can list all prefixes from files", async () => {
    await utils.using(new utils.TempDir(), async (path) => {
        const builder = new builders.LocalFilePrefixBuilder(path.toString(), 100);
        await canListAllPrefixes(builder);
    });
});
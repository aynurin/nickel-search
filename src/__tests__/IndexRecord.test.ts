import IndexRecord from "../common/IndexRecord";

it("can store original key", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 100);
    const expected = original;

    expect(received.key).toEqual(expected);
});

it("can create shard for maxShards = 100", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 100);
    const expected = "2a";

    expect(received.shard).toEqual(expected);
});

it("can create shard for maxShards = 1000", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 1000);
    const expected = "oi";

    expect(received.shard).toEqual(expected);
});

it("can create shard for maxShards = 1", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 1);
    const expected = "0";

    expect(received.shard).toEqual(expected);
});

it("can create safekey", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 100);
    const expected = "jqvh4agc123_";

    expect(received.safekey).toEqual(expected);
});

it("can create page name", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 100);
    const expected = "jqvh4agc123_-3.json";

    expect(received.getPageName(3)).toEqual(expected);
});

it("can create page uri", () => {
    const original = "g?\\c\"\u0019/123!_-";
    const received = new IndexRecord({
        docId: "1",
        fields: ["field_A"],
        value: original,
        weight: 1,
    }, 100);
    const expected = "2a/jqvh4agc123_-0.json";

    expect(received.getPageUri(0)).toEqual(expected);
});

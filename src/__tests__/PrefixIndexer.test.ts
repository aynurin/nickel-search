import SimpleTokenizer from "../components/SimpleTokenizer";
import SearchTransform from "../SearchTransform";

it("can get all prefixes", () => {
    const given = "acierates";
    const expected = [
        { weight: 1 / given.length, value: "a" },
        { weight: 2 / given.length, value: "ac" },
        { weight: 3 / given.length, value: "aci" },
        { weight: 4 / given.length, value: "acie" },
        { weight: 5 / given.length, value: "acier" },
        { weight: 6 / given.length, value: "aciera" },
        { weight: 7 / given.length, value: "acierat" },
        { weight: 8 / given.length, value: "acierate" },
        { weight: 1, value: "acierates" },
    ];

    const indexer = new SearchTransform(new SimpleTokenizer());

    const received = indexer.getTermPrefixes(given);

    expect(expected).toEqual(received);
});

it("can get phrase prefixes", () => {
    const given = "aci and any";
    const expected = [
        {value: "a", weight: 1 / 3 / 1 + 1 / 3 / 2 + 1 / 3 / 3},
        {value: "ac", weight: 2 / 3 / 1},
        {value: "aci", weight: 3 / 3 / 1},
        {value: "an", weight: 2 / 3 / 2 + 2 / 3 / 3},
        {value: "and", weight: 3 / 3 / 2},
        {value: "any", weight: 3 / 3 / 3},
    ];

    const indexer = new SearchTransform(new SimpleTokenizer());

    const received = indexer.getTermPrefixes(given);

    for (const one of expected) {
        expect(received).toContainEqual(one);
    }
    expect(received.length).toEqual(expected.length);
});

it("can get index entries", () => {
    const given = {
        f1: "and",
        f2: "any",
    };
    const docId = "someid";
    const expected = [{
        docId,
        fields: ["f1", "f2"],
        value: "a",
        weight: 1 / 3 / 1 + 1 / 3 / 1,
    }, {
        docId,
        fields: ["f1", "f2"],
        value: "an",
        weight: 2 / 3 / 1 + 2 / 3 / 1,
    }, {
        docId,
        fields: ["f1"],
        value: "and",
        weight: 3 / 3 / 1,
    }, {
        docId,
        fields: ["f2"],
        value: "any",
        weight: 3 / 3 / 1,
    }];

    const indexer = new SearchTransform(new SimpleTokenizer());

    const received = indexer.getIndexEntries(docId, given);

    for (const one of expected) {
        expect(received).toContainEqual(one);
    }
    expect(received.length).toEqual(expected.length);
});

it("can get index entries with phrases", () => {
    const given = {
        f1: "and",
        f2: "aci any",
    };
    const docId = "docid";
    const expected = [{
        docId,
        fields: ["f1", "f2"],
        value: "a",
        weight: 1 / 3 / 1 + 1 / 3 / 1 + 1 / 3 / 2,
    }, {
        docId,
        fields: ["f1", "f2"],
        value: "an",
        weight: 2 / 3 / 1 + 2 / 3 / 2,
    }, {
        docId,
        fields: ["f1"],
        value: "and",
        weight: 3 / 3 / 1,
    }, {
        docId,
        fields: ["f2"],
        value: "ac",
        weight: 2 / 3 / 1,
    }, {
        docId,
        fields: ["f2"],
        value: "aci",
        weight: 3 / 3 / 1,
    }, {
        docId,
        fields: ["f2"],
        value: "any",
        weight: 3 / 3 / 2,
    }];

    const indexer = new SearchTransform(new SimpleTokenizer());

    const received = indexer.getIndexEntries(docId, given);

    for (const one of expected) {
        expect(received).toContainEqual(one);
    }
    expect(received.length).toEqual(expected.length);
});

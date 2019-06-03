import { fileKey, shardName } from "../Utils";

it("can create shard name", () => {
    const given = "aci";
    const expected = "ma";
    const maxShards = 1000;

    const actual = shardName(given, maxShards);

    expect(actual).toEqual(expected);
});

it("can create a very different shard name for similar string", () => {
    const given = "ac";
    const expected = "qt";
    const maxShards = 1000;

    const actual = shardName(given, maxShards);

    expect(actual).toEqual(expected);
});

it("can correctly name files", () => {
    const given = {
        key: "say",
        maxShards: 1000,
        pageNum: 1,
    };
    const expected = "q6/c2F5-1.json";

    const actual = fileKey(given.pageNum, given.key, given.maxShards);

    expect(actual).toEqual(expected);
});

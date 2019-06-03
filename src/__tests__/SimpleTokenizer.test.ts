import SimpleTokenizer from "../SimpleTokenizer";

it("can tokenize one word", () => {
    const given = "acierates";
    const expected = ["acierates"];

    const tokenizer = new SimpleTokenizer();

    const received = tokenizer.tokenize(given);

    expect(expected.length).toEqual(received.length);
    expect(expected[0] === received[0]);
});

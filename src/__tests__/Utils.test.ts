import * as Utils from "../Utils";

it("can convert number to array", () => {
    const original = 15;
    const array = Utils.longToByteArray(original);
    const converted = Utils.byteArrayToLong(array);

    expect(original).toEqual(converted);
    expect(array.length).toEqual(8);
});

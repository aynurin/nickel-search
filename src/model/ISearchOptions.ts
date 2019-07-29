
import ICreateStoreOptions from "./ICreateStoreOptions";

export default interface ISearchOptions {
    indexShards: number;
    source: ICreateStoreOptions;
}

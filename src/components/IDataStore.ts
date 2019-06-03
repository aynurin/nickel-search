
export default interface IDataStore<TDoc> {
    /**
     * Creates a generator reading through the contents of the data source
     */
    readNext(): AsyncIterableIterator<{key: string, document: TDoc}>;

    readItem(key: string): Promise<TDoc | null>;

    write(key: string, item: TDoc): Promise<void>;
}

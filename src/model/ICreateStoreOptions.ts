export default interface ICreateStoreOptions {
    /**
     * Store address, must be parseable by the store's `parseOptions` method
     */
    location: string;
    /**
     * Credentials, if required by the store
     */
    credentials?: any;
    /**
     * Number of index prefixes ("sharding" simulation)
     */
    prefixes: number;
}

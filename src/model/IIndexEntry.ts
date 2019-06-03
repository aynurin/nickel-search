
export default interface IIndexEntry {
    value: string;
    fields: string[];
    docId: string;
    weight: number;
    metadata?: any;
    original?: any;
}

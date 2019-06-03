
export default interface IIndexPage {
    items: any[];
    pageUri: string;
    count: number;
    previousPageUri?: string | null;
    pageNum: number;
    nextPageUri?: string | null;
}

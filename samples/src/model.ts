
export default interface IDataModel {
    key: string;
    title: string;
    subtitle: string;
    publishers: string[];
    authors: string[];
    isbn_10: string | null;
    isbn_13: string | null;
    publish_date: string | null;
    subjects: string[];
}

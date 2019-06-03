import ITransform from "./components/ITransform";
import IWordTokenizer from "./components/IWordTokenizer";
import IndexEntry from "./model/IIndexEntry";

export default class SearchTransform implements ITransform<any, IndexEntry[]> {
    private tokenizer: IWordTokenizer;

    constructor(tokenizer: IWordTokenizer) {
        this.tokenizer = tokenizer;
    }

    public apply(key: string, sourceItem: any): IndexEntry[] {
        return this.getIndexEntries(key, sourceItem);
    }

    public getTermPrefixes(term: string): Array<{ value: string; weight: number; }> {
        // TODO: Get real tokenizer
        const allPrefixes: Array<{ value: string; weight: number; }> = [];
        const tokens = this.tokenizer.tokenize(term);
        let tokenDistance = 0;
        for (const token of tokens) {
            tokenDistance++;
            let prefix = "";
            for (const ch of token) {
                prefix = prefix + ch;
                const existing = allPrefixes.filter((p) => p.value === prefix);
                const tokenWeight = prefix.length / token.length / tokenDistance;
                if (existing.length > 1) {
                    throw new Error(`Cannot have more than one existing value ${prefix} in ${term}`);
                } else if (existing.length === 1) {
                    existing[0].weight += tokenWeight;
                } else {
                    allPrefixes.push({ value: prefix, weight: tokenWeight});
                }
            }
        }
        return allPrefixes;
    }

    public getIndexEntries(docId: string, doc: any): IndexEntry[] {
        const allEntries: IndexEntry[] = [];
        for (const field in doc) {
            if (doc.hasOwnProperty(field)) {
                let value = doc[field];
                let weight = 1;
                if (typeof value === "object") {
                    if ("value" in value) {
                        value = value.value;
                    }
                    if ("weight" in value) {
                        weight = value.weight;
                    }
                }
                if (value == null) {
                    continue;
                }
                const newEntries = this.getTermPrefixes(value).map((val) => ({
                    docId,
                    fields: [field],
                    value: val.value.toLocaleLowerCase(),
                    weight: val.weight * weight,
                }));
                for (const entry of newEntries) {
                    const existing = allEntries.filter((e) => e.value === entry.value);
                    if (existing.length > 1) {
                        throw new Error(`Cannot have more than one existing value ${entry}`);
                    } else if (existing.length === 1) {
                        existing[0].weight += entry.weight;
                        if (!existing[0].fields.some((f) => f === entry.fields[0])) {
                            existing[0].fields.push(entry.fields[0]);
                        }
                    } else {
                        allEntries.push(entry);
                    }
                }
            }
        }
        return allEntries;
    }
}

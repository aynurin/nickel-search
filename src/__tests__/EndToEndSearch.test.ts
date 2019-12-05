import fs from "fs";
import path from "path";
import rimraf from "rimraf";
import uuidv4 from "uuid/v4";

import nickel, { ICreateStoreOptions, IDataStore, IIndexerOptions, IIndexPage, ISearchable } from "../../lib/main";

it("can index and search", async () => {
    const workspaceDir = await createDir();
    try {
        const dataStoreOptions: ICreateStoreOptions = { location: await createDir(path.join(workspaceDir, "data")) };
        const indexStoreOptions: ICreateStoreOptions = { location: await createDir(path.join(workspaceDir, "index")) };

        const indexerOptions = new IndexerOptions(
            nickel.createDataStore<IDataModel>(dataStoreOptions),
            nickel.createIndexStore(indexStoreOptions),
        );
        await createSampleData(dataStoreOptions.location);
        await nickel.indexer(indexerOptions, false).run();

        const search = nickel.searcher({
            indexShards: 1000,
        }, indexerOptions.indexStore);

        const result = await search.search("th");

        expect(result).toBeTruthy();

        if (result != null) {
            expect(result.count).toBe(2);
            expect(result.items[0].secondThing).toBe(sampleData[1].secondThing);
        }
    } finally {
        await cleanDir(workspaceDir);
    }
});

async function createSampleData(dir: string) {
    for (let i = 0; i < sampleData.length; i++) {
        const itemStr = JSON.stringify(sampleData[i]);
        const fileName = path.join(dir, i + ".json");
        await new Promise((resolve, reject) => {
            fs.writeFile(fileName, itemStr, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(fileName);
                }
            });
        });
    }
}

const sampleData: IDataModel[] = [{
        firstThing: 1,
        secondThing: "A MINUTE TO MIDNIGHT",
    }, {
        firstThing: 2,
        secondThing: "THE GUARDIANS",
    }, {
        firstThing: 3,
        secondThing: "WHERE THE CRAWDADS SING",
    }, {
        firstThing: 4,
        secondThing: "TWISTED TWENTY-SIX",
    }, {
        firstThing: 5,
        secondThing: "BLUE MOON",
    },
];

interface IDataModel {
    firstThing: number;
    secondThing: string;
}

class IndexerOptions implements IIndexerOptions<IDataModel> {
    public source: IDataStore<IDataModel>;
    public indexStore: IDataStore<IIndexPage>;
    public saveThreshold: number = 100;
    public resultsPageSize: number = 100;
    public indexShards: number = 1000;

    constructor(source: IDataStore<IDataModel>, indexStore: IDataStore<IIndexPage>) {
        this.source = source;
        this.indexStore = indexStore;
    }

    public sort(a: ISearchable, b: ISearchable) {
        let weightSort = b.weight - a.weight;
        if (weightSort > 0) {
            weightSort = 1;
        } else if (weightSort < 0) {
            weightSort = -1;
        }
        const localeSort = a.original.secondThing.localeCompare(b.original.secondThing);
        // tslint:disable-next-line: max-line-length
        // console.log(`${a.original.secondThing} -> ${b.original.secondThing}: ${a.weight} -> ${b.weight}, ${localeSort}`);
        return weightSort === 0 ? localeSort : weightSort;
    }

    public getDisplayedFields = (s3Uri: string, document: IDataModel) => document;
    public getSearchedFields = (s3Uri: string, document: IDataModel) => ({ secondThing: document.secondThing });
}

async function createDir(dirPath?: string): Promise<string> {
    const dirToCreate: string = dirPath ? dirPath : path.join("./", uuidv4());
    return new Promise((resolve, reject) => {
        fs.mkdir(dirToCreate, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(dirToCreate);
            }
        });
    });
}

async function cleanDir(dir: string) {
    return new Promise((resolve, reject) => {
        rimraf(dir, (error: Error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

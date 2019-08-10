# Nickel Search

Nickel Search implements a basic serverless word prefix search.

## What is prefix search

In a full text search solution, you expect the server to return documents containing the searched words.

In a prefix search solution, you expect the server to search for all documents containing words starting with a specific prefix.

Given the advanced querying almost any full text search engine allows, prefix search is a subset of a full text search problem. For example, with Lucene (hence Solr, Elastic, and others) you can use `*` syntax to search for prefixed words. E.g., `adv*` would return documents containing `adventure`, `advanced`, and other words that start from `adv`.

The goal of this project is to allow prefix search in a serverless way, so that you don't have to pay for servers hosting Solr, Elastic, or another server.

## Current issues and TODO

1. The search doesn't support multi-word search.
2. The indexing takes a lot of time and RAM.
3. No support for synonyms, stemming/lemmatization.
4. No test coverage.
5. More ranking sampels needed.

## How to use

There is a fully functional sample in the [/samples](/samples) directory, which also includes running the indexer as a Docker container on AWS Fargate. See README.md in the [/samples](/samples) directory for more info.

Install Nickel Search:

```bash
$> npm install nickel-search
```

Implement your index model and run indexer:

```typescript
import nickel from "nickel-search";

class MyBlogPost {
    Title: string;
    Author: string;
    Body: string;
}

const options = {
    // Set fields that will be returned with search results
    getDisplayedFields: (s3Uri: string, document: MyBlogPost) => ({
        Title: document.Title,
        Author: document.Author,
    }),
    // Set fields to search against
    getSearchedFields: (s3Uri: string, document: MyBlogPost) => ({
        Title: document.Title,
    }),
    // Report progress during indexing.
    onProgress: (stage: string, key: string, document: IWordyWord, indexEntries: IIndexEntry[], counter: number) => {
        if (counter % 100 === 0) {
            console.log(`Blog posts processed: ${counter}`);
        }
    },
    // number of search results per page has to be set when creating the index
    resultsPageSize: 50,
    // save checkpoints every 100 changes to each hash value
    saveThreshold: 100,
    // shards in the index store
    indexShards: 1000,
    // Implement to set search results sort order.
    sort: (a: MyBlogPost, b: MyBlogPost) => {
        let sort = bWeight - aWeight;
        if (sort === 0) {
            sort = a.Title.localeCompare(b.Title);
        }
        return sort;
    },
    // Data source options
    source: {
        location: "../sample-data/", // existing folder with JSON files matching MyBlogPost
    },
    // Index store options
    target: {
        location: "../sample-index/", // existing folder that will store the search index
    },
};

nickel.indexer(options).run();
```

In the sample above, the indexer will `JSON.decode` all files in `../sample-data/`, apply `getDisplayedFields` and `getSearchedFields` for each file, and save the index in `../sample-index/`. The indexer will split the index into `1000` 'shards' (`{ options.indexShards: 1000 }`). The number of shards has to be similar when indexing and searching against the same index.

Run the indexer. When it's done, run the search:

```typescript
import nickel from "nickel-search";

const ns = nickel.searcher({
    indexShards: 1000,
    source: {
        location: "../sample-index/", // search index location
    },
});

const searchRequest = 'nic';
const searchResults = ns.search(searchRequest);
```

## Requirements

* Indexer can run fairly long.
  * In theory, most time consuming tasks can run in parallel but it is not implemented.
* It will store the entire index in RAM before saving it, so it will require a lot of RAM.

## Features

### When to use Nickel Search

Nickel can help if all of the following is true:

* You have a set of text documents that you want to be able to search using prefixes
* Your dataset does not change often
* You don't need advanced query syntax such as provided by Lucene or other implementations
* You don't want to pay for an always on search server (such as Elastic or Solr)

A simple example scenario is an autocomplete search for book names. We don't need advanced full text search query syntax such as provided by Lucene or other implementation. In a same way many other autocomplete scenarios can be addressed.

### When not to use Nickel Search

Don't use Nickel Search if:

* You need to rank results when querying
* You have KPIs on index update time
* You need advanced syntax querying (AND/OR/etc.)
* You need to get a response in less than 100ms
* Your dataset is larger than RAM available for indexing
* For languages other than English (or maybe submit a PR to support that language?)

## How it works

Nickel Search is a node.js app that converts a set of documents into a prefix-queriable set of documents, so that you can use the capabilities of the storage system as your prefix-search server. I use it with AWS S3, so it provides a serverless search for my projects.

## Future steps

* Make indexer resumable.
* Optimize time and memory usage.
* Try other features of mature full text search solutions and see if they can be added to Nickel.

## Release notes

### v0.3

* Changed the tokenizer to split on more punctuation marks
* Added local file buffer to reduce RAM consumption
* Enhanced sorting performance

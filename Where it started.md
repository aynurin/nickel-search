# Nickel Bloodhound

The goal is to create a basic serverless prefix search based on AWS S3.

So we are implementing a **prefix search** (e.g., autocomplete or similar) on a **rarely changing dataset** in a **serverless application** and we don't want to use a search server that needs a lot of resources running 24x7 because it keeps everything in RAM. Instead, we will implement a simple indexer that will create an S3 based index, and a searcher that will be able to use the S3-hosted index to retrieve results.

## Goal definition

### What we have

1. A set of JSON files in a file storage ([Sample](./sample-document.json))
2. The file storage is implemented using AWS S3
3. A schema, describing which fields of the JSON files should be indexed
4. The data in these fields is treated as English language text

### What we want to get in the end

A service that will accept a search query (a prefix), and return links to result documents, preferably with some metadata (like document title and maybe other fields).

Given that this is a prefix search, I do not impose any advanced query language. We are not hunting a full featured serverless full-text search at this time.

## Why

I couldn't find any serverless prefix search implementaions.

## Possible approaches

1. Hack a full-text search engine (e.g. Lucene).
   I'd really like to go with this approach but I don't believe it will be very easy to trick Lucene into forgetting about RAM and cheap access to the index storage.
2. Use a lightweight full-text search engine, like [Lunr](https://lunrjs.com/).
   There are similar implementations, e.g., [Lambda Serverless Search](https://github.com/rlingineni/Lambda-Serverless-Search). The downside is that it will need to pull all index files before each query. This just doesn't allow for a good query performance. The advantage is that it is already implemented.
3. A mixed approach.
   Implement an indexer that will put all content into a large number of tiny index files in a way that we can use heuristics based on the search query to predict a small subset of index files that contain the requested document(s). The advantage is the same as in the previous point. The disadvantage is that this approach makes me want to support all features of the underlying library, in the same time staying within the serverless constraints, hence may cause time wasted.
4. Forget about all existing implementations and knowledge and implement a basic inverted index based on S3.
   Given that our goal is _prefix search_ and there's no goal to support advanced querying, the implementation is not going to be very complicated. The disadvantage is that this solution could be difficult to maintain due to a lot of custom code. Requires some investigation.

### Side-by-side

| # | Approach | Disadvantages | How easy it seems to implement |
|---|----------|---------------|--------------------------------|
| 1. | Hack a full-text search engine | Seems like an overcomplication | +++++ |
| 2. | Use a lightweight full-text search engine | need to pull all index files before each query | + ([it is already implemented](https://github.com/rlingineni/Lambda-Serverless-Search)) |
| 3. | A mixed approach | Makes us want to support all features of the underlying library, difficult to restrict the scope and stay in schedule | ++ |
| 4. | A custom implementation | More code to write = more potential bugs, more effort to maintain, less search features | +++ |

### Resolution

At first I will try to implement #4 and see if it's maintainable and usable. If that doesn't work, I'll try to implement #3 based on [Lunr](https://lunrjs.com) with an index file management that would allow creating heuristics based on the search query to predict a small subset of index files that contain documents that I need.

Regarding the choice of the library underlying option #3:

1. If I need to replace the library - it is not that difficult to do in the future.
2. I've done a brief search and I don't want to spend time to search and compare more. [ElasticLunr](http://elasticlunr.com/) does not look maintained; the code of [search-index](https://github.com/fergiemcdowall/search-index) smells; [Fuse.js](https://fusejs.io/) is awesome but too fuzzy.

## TODOs

1. Indexer: A node.js tool that will download source documents from S3, create index files, and upload them to S3 [must-have]
2. Searcher: A node.js function that will load a subset of indexes and search on them [must-have]
3. A docker-image for indexer [nice-to-have]
4. An AWS Lambda function definition for Searcher [nice-to-have]
5. An AWS CloudFormation template to deploy all that stuff.

Godspeed!

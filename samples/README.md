# Nickel Search Samples

This folder contains examples of using the library.

## Local index

To start playing with Nickel, you can run this example locally. Just clone this repo, create an index directory, and run it. Take a look at the example source dataset that conains [about 2000 book names](../data/source) extracted from the 2019-04-30 [Open Library](https://openlibrary.org/) [dump](https://openlibrary.org/developers/dumps).

The following commands convert the source documents into a searchable index:

```bash
$> git clone git@github.com:aynurin/nickel-samples.git
$> cd ./nickel-search
$> npm install
$> mkdir ./samples/data/index
$> npm run samples:index -- --source=./samples/data/source --index=./samples/data/index
$> npm run samples:search -- --index=./samples/data/index
```

## Run on AWS

Nickel is created to take advantage of AWS S3, and the next example demonstrates how to run indexer and store the index on AWS.

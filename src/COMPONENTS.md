# Component model

This directory consists of a root `main.ts` file and four folders: `search`, `index`, `common`, and `components`. Modules in these folders should strictly follow the following dependency scheme:

![Component model](http://www.plantuml.com/plantuml/proxy?src=https://raw.github.com/aynurin/nickel-search/master/src/components.plantuml)

where:

* `main.ts` - contains everything that will be imported by user by default;
* `search` - contains all components related only to searching;
* `index` - contains all components related only to indexing;
* `common` - contains a common data model;
* `components` - contains components that should not be directly used in this package. Instead, they implement interfaces used in this package, and package users may decide to use these components.


import commander from "commander";
import readline from "readline";
import nickel from "../../lib";
import Colors from "./colors";

import definedIndex from "./target";

commander
    .option("--index <index>", "Index location")
    .parse(process.argv);

let index: any;

// console.log("commander", commander);
console.log("index", commander.index);

if (commander.index) {
    index = {
        location: commander.index,
        prefixes: 1000,
    };
} else if (definedIndex) {
    index = definedIndex;
}

const ns = nickel.searcher({
    source: index,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.setPrompt("Nickel > ");
rl.prompt();

rl.on("line", (request) => {
    return new Promise((resolve) => {
        ns.search(request)
            .then((val) => {
                if (val == null) {
                    console.error(`\n${Colors.Bright}${Colors.FgWhite}Nothing returned by server${Colors.Reset}\n`);
                } else {
                    let index = 1;
                    for (const res of val.items) {
                        const indexlabel = (index + val.pageNum * 50).toString().padStart(3);
                        console.log(`${indexlabel}. ${Colors.Bright}${Colors.FgGreen}${res.title}${Colors.Reset}` +
                            ` ${Colors.FgGreen}${res.docId}${Colors.Reset}`);
                        console.log(`     ${res.publishers.join(", ")} | ${res.authors.join(", ")}`);
                        index++;
                    }
                }
                resolve();
            })
            .catch((e) => {
                console.error(e.message);
                resolve();
            })
            .finally(() => {
                rl.prompt();
            });
    });
}).on("close", () => {
    console.log("\n\nNickel out!");
    process.exit(0);
});

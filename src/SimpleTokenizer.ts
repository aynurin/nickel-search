import IWordTokenizer from "./components/IWordTokenizer";

export default class SimpleTokenizer implements IWordTokenizer {
    public tokenize(value: string): string[] {
        return value.split(/\.\s+|\.$|\s+|[,;:?!"$*\\\/()_]/gi).filter((val) => val.length > 0);
    }
}

/*

After research on existing tokenizers, I decided to stay with this one for now. Maybe in the future,
I will find a better solution.

I tried that on the following text: "On Jan. 20, former Sen. Barack Obama became the 44th President of the U.S.
and changed his email to bobama@gov.us, isn't that true? There was a build-up of traffic on the ring road."

The downsides of this implementation are:

  - 'U.S.A.' will produce 'U.S.A' (the last dot of an acronym is lost)
  - Abbreviations will be treated as words ('Sen.' (as in "Senator") will produce 'Sen')
  - 'isn't' is left as is, while it should turn into 'is' and 'n't'

In the same time, I don't like other tokenizers, or they don't bring that much value:

  - `wink-tokenizer` has the same problem with abbrev., and even worse with acronyms. And it splits
        dash-words like 'build-up', which cannot be treated separately.
  - `natural`'s tokenizers can't even keep the emails in the same token
  - python `spacy`'s `en_core_web_sm` is so much better. It splits 'build-up', but that's the only
        downside (apart from making me either port spacy's tokenization to js or this project to python.)

I received a perfect output from Stanford CoreNLP tokenizer, which differs from the result of this implementation:

This output:

```json
[ 'On',  'Jan',  '20',  'former',  'Sen',  'Barack',  'Obama',  'became',  'the',  '44th',  'President',  'of',  'the',
          'U.S', 'and',  'changed',  'his',  'email',  'to',  'boba@gov.us',  'isn\'t',  'that',  'true?',
          'There',  'was',  'a',  'build-up',  'of',  'traffic',  'on',  'the',  'ring',  'road.' ]
```

Standford CoreNLP output:

```json
[ 'On',  'Jan.',  '20',  ',',  'former',  'Sen.',  'Barack',  'Obama',  'became',  'the',  '44th',  'President',  'of',
          'the',  'U.S.', 'and',  'changed',  'his',  'email',  'to',  'bobama@gov.us',  ',',  'is',  'n\'t',  'that',
          'true',  '?', 'There',  'was',  'a',  'build-up',  'of',  'traffic',  'on',  'the',  'ring',  'road',  '.' ]
```

Obviously, CoreNLP handles punctuation and contractions, but I guess it's overall extremely more precise than my regex,
and it's extensible to support other languages. But it is not adding so much value to my implementation right now that
I would want to spend days or even weeks to integrate it here. I'll need to look into it when implementing other
languages.

*/

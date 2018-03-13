import { Properties } from "corenlp";

export const corpusAnnotators = new Properties({
    annotators: "tokenize,ssplit,pos,lemma",
});

export const annotators = new Properties({
    annotators: "tokenize,ssplit,pos,lemma,ner,depparse",
});

import { Properties } from "corenlp";

/*

Define The Annotators required for interaction with the CoreNLP Server
----------------------------------------------------------------------

CoreNLP Annotators - https://stanfordnlp.github.io/CoreNLP/

Tokenize - "Tokenizes the text".
SSplit - "Splits a sequence of tokens into sentences."
POS - "Labels tokens with their Part-Of-Speech tag."
Lemma - "Resolve words to canonical form."
Ner - "Recognizes named entities."
*/

export const annotators = new Properties({
    annotators: "tokenize,ssplit,pos,lemma, ner",
});

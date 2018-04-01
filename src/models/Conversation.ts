import CoreNLP from "corenlp";
export type Conversation  = {
    speakers: Array<string>,
    document: CoreNLP.simple.Document
};

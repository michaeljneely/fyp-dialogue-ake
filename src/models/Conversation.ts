import CoreNLP from "corenlp";

export type Conversation  = {
    speakers: Array<string>,
    raw: string,
    annotated: CoreNLP.simple.Document;
};

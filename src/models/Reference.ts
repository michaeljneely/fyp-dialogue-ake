import CoreNLP from "corenlp";

export interface IReference {
    textFile: string;
    summaries: {
        short: string;
        medium: string;
        long: string;
    };
    keywords: Array<string>;
}

export type Reference = {
    name: string;
    summary: string;
    annotated: CoreNLP.simple.Document;
};

export type ReferenceSummaries = {
    short: string,
    medium: string,
    long: string
};

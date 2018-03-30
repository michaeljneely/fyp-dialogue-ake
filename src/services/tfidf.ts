import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";
import { corpusIDF } from "./corpus";
import { parseDocument } from "./corenlp";
import { annotators } from "../constants/annotators";
import { TermMap } from "../models/Term";
import { stopwords } from "../constants/filters";

function idfArraySort(t1: [string, number], t2: [string, number]): number {
    if (t1[1] > t2[1]) {
        return -1;
    }
    if (t1[1] < t2[1]) {
        return 1;
    }
    return 0;
}


// const posFilter = ["CD", "FW", "JJ", "JJR", "JJS", "NN", "NNS", "NNP", "NNPS", "RB", "RBR", "RBS", "VB", "VBG", "VBN", "VBP", "VBZ"];
// const nounFilter = ["NN", "NNS", "NNP", "NNPS"];

export function TFIDFSummary(termMap: TermMap, wordLength: number): [string, string] {
    const corpusTFIDFArray = new Array<[string, number]>();
    const userTFIDFArray = new Array<[string, number]>();
    for (const [lemma, term] of termMap.entries()) {
        if (stopwords.indexOf(lemma) === -1) {
            const corpusTFIDF = 1 + (Math.log(term.tf) * term.corpusIDF);
            const userTFIDF = 1 + (Math.log(term.tf) * term.userIDF);
            corpusTFIDFArray.push([lemma, corpusTFIDF]);
            userTFIDFArray.push([lemma, userTFIDF]);
        }
    }
    corpusTFIDFArray.sort(idfArraySort);
    userTFIDFArray.sort(idfArraySort);
    let corpusTFIDFSummary = "";
    let userTFIDFSummary = "";
    corpusTFIDFArray.slice(0, wordLength).forEach(([lemma, tfidf]) => {
        corpusTFIDFSummary += `${lemma} `;
    });
    userTFIDFArray.slice(0, wordLength).forEach(([lemma, tfidf]) => {
        userTFIDFSummary += `${lemma} `;
    });
    return [corpusTFIDFSummary, userTFIDFSummary];
}

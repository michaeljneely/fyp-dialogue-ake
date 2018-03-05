import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";
import { corpusIDF } from "./corpus";
import { parseDocument } from "./corenlp";
import { posFilter } from "../constants/posFilter";
import { annotators } from "../constants/annotators";

type termStats = {
    tf: number,
    idf: number
};

interface ITFIDFSummary {
    summary: string;
    terms: idfArray;

}
type TermMap = Map<string, termStats>;

type idfArray = Array<[string, number]>;

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

function buildTermFrequencyMapFromNLPDocument(document: CoreNLP.simple.Document): TermMap {
    let documentLength = 0;
    const freqMap = new Map() as TermMap;
    document.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            if (posFilter.indexOf(token.pos()) === -1) {
                const lemma: string = token.lemma();
                if (!freqMap.has(lemma)) {
                    freqMap.set(lemma, {
                        tf: 1,
                        idf: 0,
                    });
                }
                else {
                    freqMap.get(lemma).tf++;
                }
                documentLength++;
            }
        });
    });
    return freqMap;
}

export async function tfidfSummary(connector: ConnectorServer, document: string, words: number = 5): Promise<JSON> {
    const doc = await parseDocument(document);
    const map = buildTermFrequencyMapFromNLPDocument(doc);
    console.log(map);
    const iA = new Array() as idfArray;
    for (const [lemma, term] of map.entries()) {
        term.idf = await corpusIDF(lemma);
        iA.push([lemma, ((1 + Math.log(term.tf)) * term.idf)]);
    }
    const res = {summary: "", terms: []} as ITFIDFSummary;
    iA.sort(idfArraySort);
    console.log(iA);
    iA.slice(0, words).forEach(([lemma, tfidf]) => {
        res.summary += `${lemma} `;
        res.terms.push([lemma, tfidf]);
    });
    console.log(res);
    return JSON.parse(JSON.stringify(res));
}
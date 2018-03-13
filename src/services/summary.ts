import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";
import { corpusIDF } from "./corpus";
import { parseDocument } from "./corenlp";
import { posFilter } from "../constants/posFilter";
import { annotators } from "../constants/annotators";
import { Term, TermMap } from "../models/Term";
import { shuffle } from "../utils/functions";
import { TerminateEnvironmentMessage } from "aws-sdk/clients/elasticbeanstalk";

const nounFilter = ["NN", "NNS", "NNP", "NNPS"];

function buildTermMapFromNLPDocument(document: CoreNLP.simple.Document): TermMap {
    const termMap = new Map() as TermMap;
    document.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            if (posFilter.indexOf(token.pos()) === -1) {
                const lemma: string = token.lemma();
                if (!termMap.has(lemma)) {
                    termMap.set(lemma, new Term(token));
                }
                else {
                    termMap.get(lemma).tf++;
                }            }
        });
    });
    return termMap;
}

export function summaryRandom(document: CoreNLP.simple.Document, wordLength: number): Array<string> {
    const nouns = [...buildTermMapFromNLPDocument(document).values()].filter((term: Term) => {
        return nounFilter.indexOf(term.token.pos()) !== -1;
    });
    return shuffle(nouns).slice(0, wordLength).map((term: Term) => term.token.lemma());
}

export function summaryTFIDF() {

}

export function summaryTFUIDF() {

}

export function summaryLDA() {

}
export function summaryNounPhraseBasic() {

}

export function summaryNounPhraseAdvanced() {

}

export function summarySpeaker() {

}



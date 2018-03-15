import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";
import { corpusIDF } from "./corpus";
import { parseDocument } from "./corenlp";
import { posFilter } from "../constants/posFilter";
import { annotators } from "../constants/annotators";
import { Term, TermMap } from "../models/Term";
import { shuffle } from "../utils/functions";
import UserDocument, { UserDocumentModel } from "../models/UserDocument";
import { Schema } from "mongoose";
import { UserLemma } from "../models/UserLemma";
import { DocumentFrequency } from "../models/DocumentFrequency";
import User from "../models/User";

const nounFilter = ["NN", "NNS", "NNP", "NNPS"];

type LemmaMap = Map<string, number>;

interface SavedDoc {
    document: UserDocumentModel;
    lemmaMap: LemmaMap;
}

interface MappedDocument {
    termMap: TermMap;
    lemmaMap: LemmaMap;
    documentLength: number;
    documentText: string;
}

export async function addUserDocument(text: string, userID: Schema.Types.ObjectId): Promise<Array<string>> {
    let lemmaMap = new Map() as LemmaMap;
    let summaries = new Array<string>();
    return parseDocument(text, true)
        .then((result: CoreNLP.simple.Document) => {
            return mapDocument(result);
        })
        .then((mappedDocument: MappedDocument) => {
            const text = mappedDocument.documentText;
            const length = mappedDocument.documentLength;
            const termMap = mappedDocument.termMap;
            lemmaMap = mappedDocument.lemmaMap;
            summaries = buildSummaries(termMap);
            return new UserDocument({
                owner: userID,
                date: new Date(),
                text,
                length,
                summaries
            }).save();
        })
        .then((document: UserDocumentModel) => {
            const promises = [];
            for (const [lemma, term] of lemmaMap.entries()) {
                promises.push(addUserLemma(lemma, document._id, lemmaMap.get(lemma)));
            }
            return Promise.all(promises);
        })
        .then(() => {
            return Promise.resolve(summaries);
        })
        .catch((err: Error) => {
            return Promise.reject(err);
        });
}

async function addUserLemma(lemma: string, documentID: Schema.Types.ObjectId, frequency: number): Promise<UserLemma> {
    const userLemma = await UserLemma.findOne({lemma}).exec() as UserLemma;
    if (userLemma) {
        const df: DocumentFrequency = {
            documentID,
            frequency
        };
        userLemma.frequencies.push(df);
        return userLemma.save();
    }
    else {
        const newUserLemma = new UserLemma({
            lemma,
            frequencies: [({
                documentID,
                frequency
            })]
        }) as UserLemma;
        return newUserLemma.save();
    }
}

function buildSummaries(termMap: TermMap): Array<string> {
    // N random Words
    // N C_TFIDF
    // N U_TFIDF
    // N alpha * C_TFIDF + (1 - alpha) * U_TFIDF
    // N LDA
    const random = `nRandom**${summaryRandom(termMap, 5)}`;
    const summaries = new Array<string>(random);
    return summaries;
}

function mapDocument(document: CoreNLP.simple.Document): MappedDocument {
    const termMap = new Map() as TermMap;
    const lemmaMap = new Map() as LemmaMap;
    let documentLength = 0;
    let documentText = "";
    document.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            if (posFilter.indexOf(token.pos()) === -1) {
                const lemma: string = token.lemma();
                if (!termMap.has(lemma)) {
                    termMap.set(lemma, new Term(token));
                }
                else {
                    termMap.get(lemma).tf++;
                }
                if (!lemmaMap.has(lemma)) {
                    lemmaMap.set(lemma, 1);
                }
                else {
                    lemmaMap.set(lemma, lemmaMap.get(lemma) + 1);
                }
                documentLength++;
                documentText += `${lemma} `;
            }
        });
    });
    return {
        termMap,
        lemmaMap,
        documentLength,
        documentText
    };
}

// Return N random Nouns from Document as summary
export function summaryRandom(termMap: TermMap, wordLength: number): Array<string> {
    const nouns = [...termMap.values()].filter((term: Term) => {
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



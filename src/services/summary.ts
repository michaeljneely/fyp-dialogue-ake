import { logger } from "../utils/logger";
import { Term, TermMap } from "../models/Term";
import { shuffle } from "../utils/functions";
import * as mongoose from "mongoose";
import { UserLemma, UserLemmaModel } from "../models/UserLemma";
import { Summaries, UserDocument, UserDocumentModel } from "../models/UserDocument";
import { DocumentFrequencyModel } from "../models/DocumentFrequency";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { posFilter } from "../constants/posFilter";
import { wrapSync } from "async";
import { stripSpeakers } from "../utils/functions";

const nounFilter = ["NN", "NNS", "NNP", "NNPS"];


export async function userIDF(lemma: string): Promise<number> {
    try {
        const userLemma = await UserLemmaModel.findOne({lemma});
        const collectionSize = await UserDocumentModel.find().count();
        if (collectionSize) {
            const docsContainingLemma = (userLemma) ? userLemma.frequencies.length : 1;
            return Promise.resolve(Math.log(collectionSize / docsContainingLemma));
        }
        return Promise.resolve(1);
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function addUserLemma(lemma: string, userId: mongoose.Types.ObjectId, documentID: mongoose.Types.ObjectId, frequency: number): Promise<UserLemma> {
    try {
        const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
        let userLemma = await UserLemmaModel.findOne({owner: userId, lemma});
        if (userLemma) {
            userLemma.frequencies.push(documentFrequency);
        }
        else {
            userLemma = new UserLemmaModel({owner: userId, lemma, frequencies: [documentFrequency]});
        }
        const saved = await userLemma.save();
        return Promise.resolve(saved);
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function addUserDocumentToCorpus(userId: mongoose.Types.ObjectId, document: string, wordLength: number): Promise<string> {
    try {
        const [speakers, text] = stripSpeakers(document);
        const parsed = await parseDocument(text, true);
        const mappedDocument = mapDocument(parsed);
        const summaries: Summaries = {
            length: wordLength,
            random: summaryRandom(mappedDocument.termMap, wordLength).toString(),
            tfidf: "",
            tfiudf: ""
        };
        const userDocument = await new UserDocumentModel({
            owner: userId,
            text: mappedDocument.documentText,
            length: mappedDocument.documentLength,
            date: Date.now(),
            speakers,
            summaries
        }).save();
        for (const [lemma, frequency] of mappedDocument.lemmaMap.entries()) {
            await addUserLemma(lemma, userId, userDocument._id, frequency);
        }
        return Promise.resolve(userDocument.length.toString());
    } catch (err) {
        return Promise.reject(err);
    }
}

type LemmaMap = Map<string, number>;

interface SavedDoc {
    document: UserDocument;
    lemmaMap: LemmaMap;
}

interface MappedDocument {
    termMap: TermMap;
    lemmaMap: LemmaMap;
    documentLength: number;
    documentText: string;
}

// function buildSummaries(termMap: TermMap): Array<string> {
//     // N random Words
//     // N C_TFIDF
//     // N U_TFIDF
//     // N alpha * C_TFIDF + (1 - alpha) * U_TFIDF
//     // N LDA
//     const random = `nRandom**${summaryRandom(termMap, 5)}`;
//     const summaries = new Array<string>(random);
//     return summaries;
// }

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
function summaryRandom(termMap: TermMap, wordLength: number): Array<string> {
    const nouns = [...termMap.values()].filter((term: Term) => {
        return nounFilter.indexOf(term.token.pos()) !== -1;
    });
    return shuffle(nouns).slice(0, wordLength).map((term: Term) => term.token.lemma());
}

// export function summaryTFIDF() {

// }

// export function summaryTFUIDF() {

// }

// export function summaryLDA() {

// }
// export function summaryNounPhraseBasic() {

// }

// export function summaryNounPhraseAdvanced() {

// }

// export function summarySpeaker() {

// }


export async function summarize(text: string, userId: mongoose.Types.ObjectId, wordLength: number) {
    const moop = await addUserDocumentToCorpus(userId, text, wordLength);
    return Promise.resolve(moop);
}
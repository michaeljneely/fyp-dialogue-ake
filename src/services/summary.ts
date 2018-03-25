import { logger } from "../utils/logger";
import { Term, TermMap } from "../models/Term";
import { shuffle } from "../utils/functions";
import * as mongoose from "mongoose";
import { UserLemma, UserLemmaModel } from "../models/UserLemma";
import { Summaries, UserDocument, UserDocumentModel } from "../models/UserDocument";
import { DocumentFrequencyModel } from "../models/DocumentFrequency";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { wrapSync } from "async";
import * as corpusService from "./corpus";
import { TFIDFSummary } from "./tfidf";
import * as ldaService from "./lda";
import { alphaNumericFilter } from "../constants/filters";

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

export async function addUserDocumentToCorpus(userId: mongoose.Types.ObjectId, document: string, wordLength: number): Promise<JSON> {
    try {
        const result = await parseDocument(document, true);
        const parsed = result.document;
        const speakers = result.speakers;
        const mappedDocument = await mapDocument(parsed);
        const ldaTopics = await ldaService.topicise([...mappedDocument.lemmaMap.keys()], wordLength);
        const lda = ldaTopics.map((topic: string, index) => { return `topic ${index}: ${topic}`; }).toString();
        const [tfidf, tfiudf] = TFIDFSummary(mappedDocument.termMap, wordLength);
        const summaries: Summaries = {
            length: wordLength,
            random: summaryRandom(mappedDocument.termMap, wordLength).toString(),
            tfidf,
            tfiudf,
            lda
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
        return Promise.resolve(JSON.parse(JSON.stringify(userDocument.summaries)));
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

async function mapDocument(document: CoreNLP.simple.Document): Promise<MappedDocument> {
    const termMap = new Map() as TermMap;
    const lemmaMap = new Map() as LemmaMap;
    let documentLength = 0;
    let documentText = "";
    for (const sentence of document.sentences()) {
        for (const token of sentence.tokens()) {
            if (alphaNumericFilter.test(token.lemma())) {
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
                termMap.get(lemma).corpusIDF = await corpusService.corpusIDF(lemma);
                termMap.get(lemma).userIDF = await userIDF(lemma);
                documentLength++;
                documentText += `${lemma} `;
            }
        }
    }
    return Promise.resolve({
        termMap,
        lemmaMap,
        documentLength,
        documentText
    });
}

// Return N random Nouns or Noun-Phrases from Document as summary
function summaryRandom(termMap: TermMap, wordLength: number): Array<string> {
    const nouns = [...termMap.values()].filter((term: Term) => {
        return nounFilter.indexOf(term.token.pos()) !== -1;
    });
    return shuffle(nouns).slice(0, wordLength).map((term: Term) => term.token.lemma());
}

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
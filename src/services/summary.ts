import { logger } from "../utils/logger";
import { Term, TermMap } from "../models/Term";
import { shuffle, replaceStopWords } from "../utils/functions";
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
import * as _ from "lodash";
import { Stack } from "../utils/stack";
import { stopwords } from "../constants/filters";
import { queryDBpedia } from "./dbpedia";

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

export async function addUserDocumentToCorpus(userId: mongoose.Types.ObjectId, document: string, wordLength: number = 5): Promise<JSON> {
    try {
        const result = await parseDocument(document, true);
        const parsed = result.document;
        const speakers = result.speakers;
        const mappedDocument = await mapDocument(parsed);
        const ldaTopics = await ldaService.topicise([...mappedDocument.lemmaMap.keys()], wordLength);
        const lda = ldaTopics.map((topic: string, index) => { return `topic ${index}: ${topic}`; }).toString();
        const [tfidf, tfiudf] = TFIDFSummary(mappedDocument.termMap, wordLength);
        const candidateTerms = extractCandidateTerms(parsed, wordLength);
        const semanticTerms = await Promise.all(candidateTerms.map(async (term: string) => {
            const hits = await queryDBpedia(term);
            return {
                term,
                hits
            };
        }));
        semanticTerms.forEach((term) => logger.info(term.term, term.hits));
        semanticTerms.sort((a, b) => {
            if (a.hits > b.hits) {
                return -1;
            }
            else if (a.hits < b.hits) {
                return 1;
            }
            else {
                return 0;
            }
        });
        const woo = semanticTerms.map((t) => t.term).slice(0, wordLength - 1);
        const summaries: Summaries = {
            length: wordLength,
            random: summaryRandom(mappedDocument.termMap, wordLength).toString(),
            basicSemCluster: woo.toString(),
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


function extractCandidateTerms(document: CoreNLP.simple.Document, wordLength: number): Array<string> {
    const noun = ["NN", "NNS"];
    const nounPhrase = ["NNP", "NNPS"];

    function _buildStringFromStack(stack: Stack<CoreNLP.simple.Token>): string {
        let res = "";
        stack.data().forEach((token) => {
            res += `${token.word()} `;
        });
        logger.info(`Term Candidate ${res} added.`);
        return res.trim();
    }

    const candidateTerms = new Array<string>();

    const termStack = new Stack<CoreNLP.simple.Token>();

    // Noun (N) = (NN | NNS)
    // Compound Noun (C) = (JJ) * (NN | NNS)+
    // Entity (E) = (NNP | NNPS) * (S) * (NNP | NNPS)+
    for (const sentence of document.sentences()) {
        sentence.tokens().forEach((token, index) => {
            logger.info(token.pos());
            const top = termStack.peek();
            let done = false;
            // If there are currently items in the stack
            if (top) {
                // If top is stopword
                if (stopwords.indexOf(top.lemma()) !== -1) {
                    logger.info("top is stopword");
                    // Add token if it is a noun phrase
                    if (nounPhrase.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                    }
                    termStack.clear();
                    // ** Else Discard stack
                 }
                // If top is adjective
                else if (top.pos() === "JJ") {
                    logger.info("top is adjective");
                    // If token is noun
                    if (noun.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        // If next token is not a noun, terminate
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            done = true;
                        }
                    }
                    else {
                        termStack.clear();
                    }
                    // ** Else Discard Stack
                }
                // If top is Noun
                else if (!done && noun.indexOf(top.pos()) !== -1) {
                    logger.info("top is noun");
                    // Add token if it is a noun
                    if (noun.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        logger.info("another noun!");
                        // If next token is not a noun, terminate
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Compound Noun");
                            done = true;
                        }
                    } else {
                        termStack.clear();
                    }
                    // ** Else Discard stack
                }
                // If top is noun phrase
                else if (!done && nounPhrase.indexOf(top.pos()) !== -1) {
                    logger.info("top is Noun Phrase!");
                    // If token is stopword, add if stack only contains 1 Noun Phrase
                    // If token is Noun Phrase, add
                    if (((stopwords.indexOf(token.lemma()) !== -1) && (termStack.data.length === 1))) {
                        logger.info("adding stopword");
                        termStack.push(token);
                    }
                    else if (nounPhrase.indexOf(token.pos()) !== -1) {
                        logger.info("adding noun phrase");
                        termStack.push(token);
                        // If next token is not a noun phrase, terminate
                        if ((index + 1 >= sentence.tokens().length) || nounPhrase.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Entity");
                            done = true;
                        }
                    } else {
                        termStack.clear();
                    }
                }
            }
            // Otherwise we begin building a phrase
            else {
                if (stopwords.indexOf(token.lemma()) === -1) {
                    // If token is a noun, adjective, or noun phrase - add it
                    if ((noun.indexOf(token.pos()) !== -1) || (nounPhrase.indexOf(token.pos()) !== -1) || (token.pos() === "JJ")) {
                        logger.info(`Building New Phrase. Adding ${token.pos()}`);
                        termStack.push(token);
                    }
                }
            }
            // Termination?
            if (done || index === (sentence.tokens().length - 1) ) {
                logger.info("Done! Adding Term Candidate...");
                candidateTerms.push(_buildStringFromStack(termStack));
                termStack.clear();
                // Terminate stack and add to candidate phrases
            }
        });
        // Clear the stack after processing a sentence
        termStack.clear();
    }
    return _.uniq(candidateTerms);
}

function basicSemCluster(termMap: TermMap, wordLength: number): Array<string> {
    // Noun (NNP | NNPS)
    // Compound Noun (JJ) & (NN|NNS)+
    // Entity (NNP|NNPS) * (0-1 stop word) * (NN|NNPS)+
    const nounPhrases = [...termMap.values()].filter((term: Term) => {
        logger.info(term.token.after());
        return (term.token.pos() === "NNP" || term.token.pos() === "NNPS");
    });
    const bleep = _.sortBy(nounPhrases, [function(term: Term) {
        return term.userIDF;
    }]);
    return bleep.slice(bleep.length - 6 , bleep.length - 1).map((term: Term) => term.token.lemma());
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
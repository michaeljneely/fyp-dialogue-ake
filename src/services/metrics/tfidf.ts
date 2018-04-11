import * as mongoose from "mongoose";
import { CandidateTerm, CorpusCandidateTerm, CorpusCandidateTermModel, UserCandidateTerm, UserCandidateTermModel } from "../../models/CandidateTerm";
import { CorpusDocument, CorpusDocumentModel, UserDocument, UserDocumentModel } from "../../models/Document";
import { CorpusLemma, CorpusLemmaModel, UserLemma, UserLemmaModel } from "../../models/Lemma";
import { Term } from "../../models/Term";
import { sleep } from "../../utils/functions";
import { logger } from "../../utils/logger";

/*
    Service to Calculate TFIDF Metrics
        - Term Frequency (tf): Occurrences of a term in a document
        - Inverse Document Frequency (idf): Measure of the degree of information a term provides
        - Logarithmically Scaled TFIDF Scheme: (1 + log(tf)) * (log(N/Nt))
        - Where N = number of documents, and Nt = Number of documents that contain term t

    IDF Measures are derived from the application's corpus, the user's corpus, or a weighted combination.
*/

/**
 * Calculate logarithm normalized TFIDF
 * @param {number} tf - Term Frequency
 * @param {number} idf - Inverse Document Frequency
 * @returns {number} tfidf
 */
export function calculateTFIDF(tf: number, idf: number): number {
    return ((1 + Math.log2(tf)) * idf);
}

/**
 * Calculate weighted logarithm normalized TFIDF from the Applications' Corpus and the User's Corpus
 * @param {number} tf- Term Frequency
 * @param {number} cIdf - Inverse Document Frequency obtained from application corpus
 * @param {number} uIdf - Inverse Document Frequency obtained from user corpus
 * @param {number} k - How much weight to give the user corpus (K is between 0 and 1)
 * returns {number} weighted tfidf
 */
export function calculateWeightedTFUIDF(tf: number, cIdf: number, uIdf: number, k: number = 0.5): number {
    if (k < 0 || k > 1) {
        throw new Error("K parameter must be between 0 and 1");
    }
    return ((1 + Math.log2(tf)) * ((k * uIdf) + ((1 - k) * cIdf)));
}

/**
 * Calculate the Inverse Document Frequency of a lemma in the User's corpus
 * @param userId User ID
 * @param lemma Lemma
 * @param collectionSize Total Number of Document's in the User's corpus
 */
export async function lemmaIDFUser(userId: mongoose.Types.ObjectId, lemma: string): Promise<number> {
    try {
        let collectionSize = await UserDocumentModel.find({owner: userId}).count();
        // Assume padding of one document
        if (collectionSize === 0) {
            collectionSize = 1;
        }
        const userLemma = await UserLemmaModel.findOne({owner: userId, lemma});
        const docsContainingLemma = (userLemma) ? userLemma.frequencies.length : 1;
        return Promise.resolve(Math.log2(collectionSize / docsContainingLemma));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Calculate the Inverse Document Frequency of a Lemma in the Application's Corpus
 * @param lemma Lemma
 * @param collectionSize Total Number of Document's in the Application's corpus
 */
export async function lemmaIDFCorpus(lemma: string): Promise<number> {
    try {
        const collectionSize = await CorpusDocumentModel.find({}).count();
        const corpusLemma = await CorpusLemmaModel.findOne({lemma});
        const docsContainingLemma = (corpusLemma) ? corpusLemma.frequencies.length : 1;
        return Promise.resolve(Math.log2(collectionSize / docsContainingLemma));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Calculate the Inverse Document Frequency of a Candidate Term in the User's corpus
 * @param userId User ID
 * @param candidateTerm Candidate Term
 * @param collectionSize Total Number of Document's in the User's corpus
 */
export async function termIDFUser(userId: mongoose.Types.ObjectId, term: Term): Promise<number> {
    try {
        const collectionSize = await UserDocumentModel.find({owner: userId}).count();
        const userCandidateTerm = await UserCandidateTermModel.findOne({owner: userId, term: term.term, type: term.type });
        const docsContainingCandidateTerm = (userCandidateTerm) ? userCandidateTerm.frequencies.length : 1;
        return Promise.resolve(Math.log2(collectionSize / docsContainingCandidateTerm));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Calculate the Inverse Document Frequency of a Candidate Term in the Application's corpus
 * @param candidateTerm Candidate Term
 * @param collectionSize Total Number of Document's in the Application's corpus
 */
export async function termIDFCorpus(term: Term): Promise<number> {
    try {
        const collectionSize = await CorpusDocumentModel.find({}).count();
        const corpusCandidateTerm = await CorpusCandidateTermModel.findOne({term: term.term, type: term.type});
        const docsContainingCorpusCandidateTerm = (corpusCandidateTerm) ? corpusCandidateTerm.frequencies.length : 1;
        return Promise.resolve(Math.log2(collectionSize / docsContainingCorpusCandidateTerm));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

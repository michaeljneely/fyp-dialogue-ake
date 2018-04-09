import * as mongoose from "mongoose";
import { ExtractedCandidateTerm, ExtractedCandidateTermMap } from "../../models/CandidateTerm";
import { Conversation } from "../../models/Conversation";
import { CorpusDocumentModel } from "../../models/CorpusDocument";
import { Reference } from "../../models/Reference";
import { buildSummaryTermArray, GeneratedSummary, Summary } from "../../models/Summary";
import { UserDocumentModel } from "../../models/UserDocument";
import { logger } from "../../utils/logger";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, calculateWeightedTFUIDF } from "../metrics/tfidf";
import { candidateTermIDFCorpus, candidateTermIDFUser } from "../metrics/tfidf";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";

/*
    Summary Methods that Use Candidate Terms (NP Chunks) and TFIDF Calculations
*/

/**
 * This summary method calculates the top Candidate Terms as ranked by TFIDF (application corpus only)
 */
export class CorpusCandidateTermTFIDFSummary extends Summary {
    constructor(conversation: Conversation, references: Array<Reference>, keywords: Array<string>) {
        super(conversation, references, keywords);
        this.summaryMethod = "CorpusCandidateTermTFIDFSummary";
    }

    public summarize(): Promise<GeneratedSummary[]> {
        try {
            const candidateTerms = extractCandidateTermsFromCoreNLPDocument(this.conversation.annotated);
            const generatedSummaries = this.references.map(async (reference, index) => {
                const referenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(reference.annotated);
                const candidateSummary = await candidateTermTFIDFSummary(candidateTerms, referenceCandidateTerms.size());
                const referenceSummary = referenceCandidateTerms.toStringArray();
                return {
                    reference,
                    method: this.summaryMethod,
                    summary: buildSummaryTermArray(candidateSummary, reference.summary.toLowerCase()),
                    scores: calculateAllScores(candidateSummary, referenceSummary, 2)
                } as GeneratedSummary;
            });
            return Promise.all(generatedSummaries);
        }
        catch (error) {
            logger.error(error);
            return Promise.reject(error);
        }
    }
}

/**
 * This summary method calculates the top Candidate Terms as ranked by Weighted TFIDF (application and user corpus)
 */
export class UserCandidateTermTFIDFSummary extends Summary {

    constructor(conversation: Conversation, references: Array<Reference>, keywords: Array<string>, userId: mongoose.Types.ObjectId) {
        super(conversation, references, keywords, userId);
        this.summaryMethod = "UserCandidateTermTFIDFSummary";
    }

    public summarize(): Promise<GeneratedSummary[]> {
        try {
            const candidateTerms = extractCandidateTermsFromCoreNLPDocument(this.conversation.annotated);
            const generatedSummaries = this.references.map(async (reference, index) => {
                const referenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(reference.annotated);
                const candidateSummary = await candidateTermTFUIDFSummary(this.userId, candidateTerms, referenceCandidateTerms.size());
                const referenceSummary = referenceCandidateTerms.toStringArray();
                return {
                    reference,
                    method: this.summaryMethod,
                    summary: buildSummaryTermArray(candidateSummary, reference.summary.toLowerCase()),
                    scores: calculateAllScores(candidateSummary, referenceSummary, 2),
                } as GeneratedSummary;
            });
            return Promise.all(generatedSummaries);
        }
        catch (error) {
            logger.error(error);
            return Promise.reject(error);
        }
    }
}

// Used for term sorting
type candidateTermWithTFIDF = {
    ct: ExtractedCandidateTerm,
    tfidf: number
};

/**
 * Extract the Top 'N' Candidate Terms based on TFIDF ranking (application corpus only)
 * @param {ExtractedCandidateTermMap} candidateTerms Extracted Candidate Term Map
 * @param {number} length Number of terms to return
 * @returns {Array<string>} Top N terms based on TFIDF ranking (application corpus only)
 */
async function candidateTermTFIDFSummary(candidateTerms: ExtractedCandidateTermMap, length: number): Promise<Array<string>> {
    try {
        const terms = new Array<candidateTermWithTFIDF>();
        for (const candidateTerm of candidateTerms) {
            const idf = await candidateTermIDFCorpus(candidateTerm["0"]);
            terms.push({ct: candidateTerm["0"], tfidf: calculateTFIDF(candidateTerm["1"], idf)});
        }
        return Promise.resolve(sortAndReturn(terms, length));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Extract the Top 'N' Candidate Terms based on Weighted TFIDF ranking (application and user corpus)
 * @param {ObjectId} userId User ID
 * @param {ExtractedCandidateTermMap} candidateTerms Extracted Candidate Term Map
 * @param {number} length Number of terms to return
 * @returns {Array<string>} Top N terms based on Weighted TFIDF ranking (application and user corpus)
 */
export async function candidateTermTFUIDFSummary(userId: mongoose.Types.ObjectId, candidateTerms: ExtractedCandidateTermMap, length: number): Promise<Array<string>> {
    const terms = new Array<candidateTermWithTFIDF>();
    try {
        for (const candidateTerm of candidateTerms) {
            const uIdf = await candidateTermIDFUser(userId, candidateTerm["0"]);
            const cIdf = await candidateTermIDFCorpus(candidateTerm["0"]);
            terms.push({ct: candidateTerm["0"], tfidf: calculateWeightedTFUIDF(candidateTerm["1"], cIdf, uIdf, 0.5)});
        }
        return Promise.resolve(sortAndReturn(terms, length));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Perform a descending sort of Candidate Terms by TFIDF and return the top N
 * @param {Array<CandidateTermTFIDF>} ctWithTFIDF terms with their corresponding TFIDF value
 * @param {number} length Number of Candidate Terms to return
 * returns {Array<string>} Top N Candidate Terms
 */
function sortAndReturn(ctWithTFIDF: Array<candidateTermWithTFIDF>, length: number): Array<string> {
    let returned: Array<candidateTermWithTFIDF>;
    if (length > ctWithTFIDF.length) {
        returned = ctWithTFIDF;
    }
    else {
        returned = ctWithTFIDF.sort((term1, term2) => {
            if (term1.tfidf > term2.tfidf) {
                return -1;
            }
            else if (term1.tfidf < term2.tfidf) {
                return 1;
            }
            else return 0;
        }).slice(0, length);
    }
    return returned.map((term) => term.ct.term);
}

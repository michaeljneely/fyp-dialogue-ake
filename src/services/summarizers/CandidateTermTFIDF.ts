import * as mongoose from "mongoose";
import { CandidateTerm } from "../../models/CandidateTerm";
import { Conversation } from "../../models/Conversation";
import { CorpusDocumentModel, UserDocumentModel } from "../../models/Document";
import { Reference } from "../../models/Reference";
import { GeneratedSummary, ISummary } from "../../models/Summary";
import { logger } from "../../utils/logger";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, calculateWeightedTFUIDF } from "../metrics/tfidf";
import { termIDFCorpus, termIDFUser } from "../metrics/tfidf";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";

// Used for term sorting
type candidateTermWithTFIDF = {
    ct: CandidateTerm,
    tfidf: number
};

/**
 * Extract the Top 'N' Candidate Terms based on TFIDF ranking (application corpus only)
 * @param {ExtractedCandidateTermMap} candidateTerms Extracted Candidate Term Map
 * @param {number} length Number of terms to return
 * @returns {Array<string>} Top N terms based on TFIDF ranking (application corpus only)
 */
export async function candidateTermTFIDFSummary(candidateTerms: Map<string, number>, length: number, docFromCorpus: boolean = false): Promise<ISummary> {
    try {
        const terms = new Array<candidateTermWithTFIDF>();
        for (const candidateTerm of candidateTerms) {
            let idf = await termIDFCorpus(CandidateTerm.fromString(candidateTerm["0"]));
            if (idf > 1 && docFromCorpus) {
                idf -= 1;
            }
            terms.push({ct: CandidateTerm.fromString(candidateTerm["0"]), tfidf: calculateTFIDF(candidateTerm["1"], idf)});
        }
        return {
            method: "CandidateTermTFIDFSummary",
            summary: sortAndReturn(terms, length),
            candidateTerms: candidateTerms
        };
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
export async function candidateTermTFUIDFSummary(userId: mongoose.Types.ObjectId, candidateTerms: Map<string, number>, length: number): Promise<ISummary> {
    const terms = new Array<candidateTermWithTFIDF>();
    try {
        for (const candidateTerm of candidateTerms) {
            const uIdf = await termIDFUser(userId, CandidateTerm.fromString(candidateTerm["0"]));
            const cIdf = await termIDFCorpus(CandidateTerm.fromString(candidateTerm["0"]));
            terms.push({ct: CandidateTerm.fromString(candidateTerm["0"]), tfidf: calculateWeightedTFUIDF(candidateTerm["1"], cIdf, uIdf, 0.5)});
        }
        return {
            method: "CandidateTermTFUIDFSummary",
            summary: sortAndReturn(terms, length),
            candidateTerms: candidateTerms
        };
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

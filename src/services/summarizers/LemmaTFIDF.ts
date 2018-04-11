import * as mongoose from "mongoose";
import { Conversation } from "../../models/Conversation";
import { CorpusDocumentModel, UserDocumentModel } from "../../models/Document";
import { Reference } from "../../models/Reference";
import { GeneratedSummary, ISummary } from "../../models/Summary";
import { logger } from "../../utils/logger";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, calculateWeightedTFUIDF } from "../metrics/tfidf";
import { lemmaIDFCorpus, lemmaIDFUser } from "../metrics/tfidf";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "../processors/lemma";

/*
    Summary Methods that Use Candidate Terms (NP Chunks) and TFIDF Calculations
*/
// Used for term sorting
type LemmaWithTFIDF = {
    lemma: string;
    tfidf: number;
};

/**
 * This summary method calculates the top lemmas as ranked by TFIDF (application corpus only)
 */
export async function corpusLemmaTFIDFSummary(lemmas: Map<string, number>, length: number): Promise<ISummary> {
    try {
        const lemmasWithTFIDF = new Array<LemmaWithTFIDF>();
        for (const tuple of lemmas) {
            const idf = await lemmaIDFCorpus(tuple["0"]);
            lemmasWithTFIDF.push({
                lemma: tuple["0"],
                tfidf: calculateTFIDF(tuple["1"], idf)
            });
        }
        return {
            method: "CorpusLemmaTFIDFSummary",
            summary: sortAndReturn(lemmasWithTFIDF, length).join(", "),
            lemmas
        };
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * This summary method calculates the top lemmas as ranked by Weighted TFIDF (application and user corpus)
 */
export async function userLemmaTFIDFSummary(userID: mongoose.Types.ObjectId, lemmas: Map<string, number>, length: number): Promise<ISummary> {
    try {
        const lemmasWithTFIDF = new Array<LemmaWithTFIDF>();
        for (const tuple of lemmas) {
            const uIdf = await lemmaIDFUser(userID, tuple["0"]);
            const cIdf = await lemmaIDFCorpus(tuple["0"]);
            lemmasWithTFIDF.push({
                lemma: tuple["0"],
                tfidf: calculateWeightedTFUIDF(tuple["1"], cIdf, uIdf, 0.5)
            });
        }
        return {
            method: "UserLemmaTFIDFSummary",
            summary: sortAndReturn(lemmasWithTFIDF, length).join(", "),
            lemmas
        };
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}



/**
 * Extract the Top 'N' lemmas based on TFIDF ranking (application corpus only)
 * @param {Map<string, number>} lemmas Extracted (Lemma -> Frequency) Map
 * @param {number} length Number of lemmas to return
 * @returns {Array<string>} Top N lemmas based on TFIDF ranking (application corpus only)
 */

/**
 * Extract the Top 'N' lemmas based on Weighted TFIDF ranking (application and user corpus)
 * @param {ObjectId} userId User ID
 * @param {Map<string, number>} lemmaMap Extracted (Lemma -> Frequency) Map
 * @param {number} length Number of lemmas to return
 * @returns {Array<string>} Top N lemmas based on Weighted TFIDF ranking (application and user corpus)
 */

/**
 * Perform a descending sort of lemmas by TFIDF and return the top N
 * @param {Array<termTFIDF>} lemmasWithTFIDF lemmas with their corresponding TFIDF value
 * @param {number} length Number of lemmas to return
 * returns {Array<string>} Top N lemmas
 */
function sortAndReturn(lemmasWithTFIDF: Array<LemmaWithTFIDF>, length: number): Array<string> {
    let returned: Array<LemmaWithTFIDF>;
    if (length > lemmasWithTFIDF.length) {
        returned = lemmasWithTFIDF;
    }
    else {
        returned = lemmasWithTFIDF.sort((term1, term2) => {
            if (term1.tfidf > term2.tfidf) {
                return -1;
            }
            else if (term1.tfidf < term2.tfidf) {
                return 1;
            }
            else return 0;
        }).slice(0, length);
    }
    return returned.map((term) => term.lemma);
}

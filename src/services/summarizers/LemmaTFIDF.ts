import * as mongoose from "mongoose";
import { Conversation } from "../../models/Conversation";
import { CorpusDocumentModel } from "../../models/CorpusDocument";
import { Reference } from "../../models/Reference";
import { buildSummaryTermArray, GeneratedSummary, Summary } from "../../models/Summary";
import { UserDocumentModel } from "../../models/UserDocument";
import { logger } from "../../utils/logger";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, calculateWeightedTFUIDF } from "../metrics/tfidf";
import { lemmaIDFCorpus, lemmaIDFUser } from "../metrics/tfidf";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "../processors/lemma";

/*
    Summary Methods that Use Candidate Terms (NP Chunks) and TFIDF Calculations
*/

/**
 * This summary method calculates the top lemmas as ranked by TFIDF (application corpus only)
 */
export class CorpusLemmaTFIDFSummary extends Summary {
    constructor(conversation: Conversation, references: Array<Reference>, keywords: Array<string>) {
        super(conversation, references, keywords);
        this.summaryMethod = "CorpusLemmaTFIDFSummary";
    }

    public summarize(): Promise<Array<GeneratedSummary>> {
        try {
            const meaningfulTerms = extractMeaningfulLemmasFromCoreNLPDocument(this.conversation.annotated);
            const generatedSummaries = this.references.map(async (reference, index) => {
                const referenceTerms = extractMeaningfulLemmasFromCoreNLPDocument(reference.annotated);
                const candidateSummary = await lemmaTFIDFSummary(meaningfulTerms, referenceTerms.size);
                const referenceSummary = lemmaMapToArray(referenceTerms);
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

/**
 * This summary method calculates the top lemmas as ranked by Weighted TFIDF (application and user corpus)
 */
export class UserLemmaTFIDFSummary extends Summary {
    constructor(conversation: Conversation, references: Array<Reference>, keywords: Array<string>, userId: mongoose.Types.ObjectId) {
        super(conversation, references, keywords, userId);
        this.summaryMethod = "UserLemmaTFIDFSummary";
    }

    public summarize(): Promise<Array<GeneratedSummary>> {
        try {
            const meaningfulTerms = extractMeaningfulLemmasFromCoreNLPDocument(this.conversation.annotated);
            const generatedSummaries = this.references.map(async (reference, index) => {
                const referenceTerms = extractMeaningfulLemmasFromCoreNLPDocument(reference.annotated);
                const candidateSummary = await lemmaTFUIDFSummary(this.userId, meaningfulTerms, referenceTerms.size);
                const referenceSummary = lemmaMapToArray(referenceTerms);
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
type lemmaWithTFIDF = {
    lemma: string,
    tfidf: number
};

function lemmaMapToArray(lemmaMap: Map<string, number>): Array<string> {
    return [...lemmaMap.keys()];
}

/**
 * Extract the Top 'N' lemmas based on TFIDF ranking (application corpus only)
 * @param {Map<string, number>} lemmas Extracted (Lemma -> Frequency) Map
 * @param {number} length Number of lemmas to return
 * @returns {Array<string>} Top N lemmas based on TFIDF ranking (application corpus only)
 */
async function lemmaTFIDFSummary(lemmas: Map<string, number>, length: number): Promise<Array<string>> {
    try {
        const tfidf = new Array<lemmaWithTFIDF>();
        const collectionSize = await CorpusDocumentModel.find().count();
        for (const [lemma, frequency] of lemmas) {
            const idf = await lemmaIDFCorpus(lemma);
            tfidf.push({lemma, tfidf: calculateTFIDF(frequency, idf)});
        }
        return Promise.resolve(sortAndReturn(tfidf, length));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Extract the Top 'N' lemmas based on Weighted TFIDF ranking (application and user corpus)
 * @param {ObjectId} userId User ID
 * @param {Map<string, number>} lemmaMap Extracted (Lemma -> Frequency) Map
 * @param {number} length Number of lemmas to return
 * @returns {Array<string>} Top N lemmas based on Weighted TFIDF ranking (application and user corpus)
 */
async function lemmaTFUIDFSummary(userId: mongoose.Types.ObjectId, terms: Map<string, number>, length: number, k: number = 0.5): Promise<Array<string>> {
    try {
        if (k > 1 || k < 0) {
            throw ("K must be in range 0 - 1");
        }
        const tfidf = new Array<lemmaWithTFIDF>();
        const collectionSize = await UserDocumentModel.find().count();
        for (const [lemma, frequency] of terms) {
            const uIdf = await lemmaIDFUser(userId, lemma);
            const cIdf = await lemmaIDFCorpus(lemma);
            const tfuidf = calculateWeightedTFUIDF(frequency, cIdf, uIdf, k);
            tfidf.push({lemma, tfidf: tfuidf});
        }
        return Promise.resolve(sortAndReturn(tfidf, length));
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Perform a descending sort of lemmas by TFIDF and return the top N
 * @param {Array<termTFIDF>} lemmasWithTFIDF lemmas with their corresponding TFIDF value
 * @param {number} length Number of lemmas to return
 * returns {Array<string>} Top N lemmas
 */
function sortAndReturn(lemmasWithTFIDF: Array<lemmaWithTFIDF>, length: number): Array<string> {
    let returned: Array<lemmaWithTFIDF>;
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

import _ = require("lodash");
import * as mongoose from "mongoose";
import { replaceSmartQuotes, stripSpeakers } from "../utils/functions";
import { logger } from "../utils/logger";
import * as coreNLPService from "./corenlp/corenlp";
import { saveUserDocument } from "./documents/user";
import { extractCandidateTermsFromCoreNLPDocument } from "./processors/candidateTerm";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "./processors/lemma";
import { extractNamedEntitiesFromCoreNLPDocument } from "./processors/namedEntities";
import { candidateTermTFUIDFSummary } from "./summarizers/CandidateTermTFIDF";
import { npAndNERSummary } from "./summarizers/NPandNER";

/*
    Service that uses the best performing Summary Strategy to summarize a conversation
*/

// Contract with Controller
export type Summary = {
    speakers: string,
    summary: string
};

/**
 * Use the best summary strategy to summarize a conversation
 * @param text Conversation
 * @param userId User ID
 * @param wordLength Length of summary
 * @returns {Summary} the summarized conversation and its formatted speakers
 */
export async function summarizeConversation(text: string, userId: mongoose.Types.ObjectId, wordLength: number): Promise<Summary> {
    try {
        // Annotate conversation
        const [speakers, conversation] = stripSpeakers(text);

        const annotated = await coreNLPService.annotate(conversation);

        // Extract lemmas and terms
        const lemmas = extractMeaningfulLemmasFromCoreNLPDocument(annotated);
        const candidateTerms = extractCandidateTermsFromCoreNLPDocument(annotated);
        const namedEntities = extractNamedEntitiesFromCoreNLPDocument(annotated);

        // Build Summary
        const summary = await npAndNERSummary(annotated, candidateTerms, namedEntities, wordLength);

        // Save document, lemmas, and candidate terms
        const saved = await saveUserDocument(userId, speakers, annotated, text, lemmas, candidateTerms, namedEntities);

        // Return best summary - at the moment: NP/NER
        return Promise.resolve({
            speakers: formatSpeakers(speakers),
            summary: summary.summary
        } as Summary);
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Transform an array of speakers into the beginning of an English sentence
 * @param {Array<string>} speakers Array of speakers
 * @returns {string} Speakers as the beginning of an English Sentence
 * @example formatSpeakers(["John", "Mary", "Jim"]) -> "John, Mary, and Jim"
 */
function formatSpeakers(speakers: Array<string>): string {
    return speakers.map((speaker, index) => {
        if (speakers.length === 1) {
            return speaker;
        }
        if (speakers.length >= 2 && index === speakers.length - 1) {
            return `and ${speaker}`;
        }
        else {
            return `${speaker}, `;
        }
    }).join("");
}

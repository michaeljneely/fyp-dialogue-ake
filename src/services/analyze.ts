import CoreNLP from "corenlp";
import * as mongoose from "mongoose";
import { CandidateTerm } from "../models/CandidateTerm";
import { Conversation } from "../models/Conversation";
import { CorpusDocumentModel } from "../models/Document";
import { MetricTypes } from "../models/Metrics";
import { NamedEntityTerm } from "../models/NamedEntityTerm";
import { Reference } from "../models/Reference";
import { FinalSummary, GeneratedSummary, SummaryTerm } from "../models/Summary";
import { stripSpeakers } from "../utils/functions";
import { logger } from "../utils/logger";
import { annotate } from "./corenlp/corenlp";
import { calculateAllScores } from "./metrics/scores";
import { extractCandidateTermsFromCoreNLPDocument } from "./processors/candidateTerm";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "./processors/lemma";
import { extractNamedEntitiesFromCoreNLPDocument } from "./processors/namedEntities";
import { candidateTermTFIDFSummary, candidateTermTFUIDFSummary } from "./summarizers/CandidateTermTFIDF";
import { LDASummary } from "./summarizers/LatentDirichletAllocation";
import { corpusLemmaTFIDFSummary, userLemmaTFIDFSummary } from "./summarizers/LemmaTFIDF";
import { npAndNERSummary } from "./summarizers/NounPhraseAndNamedEntity";

/*
    Service to analyze a User-provided conversation, or one that already exists in the application corpus
    Returns JSON that is formatted by the 'results' template
*/

/**
 * Analyze a user provided conversation
 * @param {ObjectID} userId User ID
 * @param {string} rawConversation Raw text of the conversation
 * @param {string} keywords User-provided keywords that capture the essence of the conversation
 * @param {string} shortSummary User-provided short summary of the conversation
 * @param {string} mediumSummary User-provided medium-length summary of the conversation
 * @param {string} longSummary User-provided long summary of the conversation
 * @returns {JSON} JSON to display results
 */
export async function analyzeUserConversation(userId: mongoose.Types.ObjectId, rawConversation: string, keywords: string, shortSummary: string, mediumSummary: string, longSummary: string): Promise<JSON> {
    try {
        const [speakers, text] = stripSpeakers(rawConversation);
        const keyWordArray = keywords.split(",");

        const conversation: Conversation  = {
            speakers: speakers,
            raw: rawConversation,
            annotated: await annotate(text)
        };
        const shortReference: Reference = {
            name: "Short Summary",
            summary: shortSummary,
            annotated: await annotate(shortSummary)
        };
        const mediumReference  = {
            name: "Medium Summary",
            summary: mediumSummary,
            annotated: await annotate(mediumSummary)
        };
        const longReference  = {
            name: "Long Summary",
            summary: longSummary,
            annotated: await annotate(longSummary)
        };

        // Extract Lemmas
        const shortReferenceLemmas = extractMeaningfulLemmasFromCoreNLPDocument(shortReference.annotated);
        const mediumReferenceLemmas = extractMeaningfulLemmasFromCoreNLPDocument(mediumReference.annotated);
        const longReferenceLemmas = extractMeaningfulLemmasFromCoreNLPDocument(longReference.annotated);
        const conversationLemmas = extractMeaningfulLemmasFromCoreNLPDocument(conversation.annotated);

        // Extract Candidate Terms
        const shortReferenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(shortReference.annotated);
        const mediumReferenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(mediumReference.annotated);
        const longReferenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(longReference.annotated);
        const conversationCandidateTerms = extractCandidateTermsFromCoreNLPDocument(conversation.annotated);

        // Extract Named Entities
        const shortReferenceNamedEntities = extractNamedEntitiesFromCoreNLPDocument(shortReference.annotated);
        const mediumReferenceNamedEntities = extractNamedEntitiesFromCoreNLPDocument(mediumReference.annotated);
        const longReferenceNamedEntities = extractNamedEntitiesFromCoreNLPDocument(longReference.annotated);
        const conversationNamedEntities = extractNamedEntitiesFromCoreNLPDocument(conversation.annotated);

        // Build Summaries
        const shortCandidateTermTFIDFSummary = await candidateTermTFIDFSummary(conversationCandidateTerms, shortReferenceCandidateTerms.size);
        const mediumCandidateTermTFIDFSummary = await candidateTermTFIDFSummary(conversationCandidateTerms, mediumReferenceCandidateTerms.size);
        const longCandidateTermTFIDFSummary = await candidateTermTFIDFSummary(conversationCandidateTerms, longReferenceCandidateTerms.size);

        const shortLemmaTFIDFSummary = await corpusLemmaTFIDFSummary(conversationLemmas, shortReferenceLemmas.size);
        const mediumLemmaTFIDFSummary = await corpusLemmaTFIDFSummary(conversationLemmas, mediumReferenceLemmas.size);
        const longLemmaTFIDFSummary = await corpusLemmaTFIDFSummary(conversationLemmas, longReferenceLemmas.size);

        const shortLDASummary = LDASummary(conversation.annotated, conversationCandidateTerms, shortReferenceCandidateTerms.size, 1);
        const mediumLDASummary = LDASummary(conversation.annotated, conversationCandidateTerms, mediumReferenceCandidateTerms.size, 1);
        const longLDASummary = LDASummary(conversation.annotated, conversationCandidateTerms, longReferenceCandidateTerms.size, 1);

        // TODO - Pick number of terms
        // const shortBestSummary = await npAndNERSummary(conversation.annotated, conversationCandidateTerms, conversationNamedEntities, 10);
        // const mediumBestSummary = await npAndNERSummary(conversation.annotated, conversationCandidateTerms, conversationNamedEntities, 15);
        // const longBestSummary = await npAndNERSummary(conversation.annotated, conversationCandidateTerms, conversationNamedEntities, 20);

        // Evaluate Summaries
        const summary1 = [
            buildSummaryAnalysisResult(shortReference, "CandidateTermTFIDFSummary", shortCandidateTermTFIDFSummary.summary, candidateTermMapToStringArray(shortReferenceCandidateTerms), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(mediumReference, "CandidateTermTFIDFSummary", mediumCandidateTermTFIDFSummary.summary, candidateTermMapToStringArray(mediumReferenceCandidateTerms), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(longReference, "CandidateTermTFIDFSummary", longCandidateTermTFIDFSummary.summary, candidateTermMapToStringArray(longReferenceCandidateTerms), ["Recall", "Precision", "Keywords"])
        ];

        const summary2 = [
            buildSummaryAnalysisResult(shortReference, "CorpusLemmaSummary", shortLemmaTFIDFSummary.summary, lemmaMapToStringArray(shortReferenceLemmas), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(mediumReference, "CorpusLemmaSummary", mediumLemmaTFIDFSummary.summary, lemmaMapToStringArray(mediumReferenceLemmas), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(longReference, "CorpusLemmaSummary", longLemmaTFIDFSummary.summary, lemmaMapToStringArray(longReferenceLemmas), ["Recall", "Precision", "Keywords"])
        ];

        const summary3 = [
            buildSummaryAnalysisResult(shortReference, "CorpusLDASummary", shortLDASummary.summary, candidateTermMapToStringArray(shortReferenceCandidateTerms), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(mediumReference, "CorpusLDASummary", mediumLDASummary.summary, candidateTermMapToStringArray(mediumReferenceCandidateTerms), ["Recall", "Precision", "Keywords"]),
            buildSummaryAnalysisResult(longReference, "CorpusLDASummary", longLDASummary.summary, candidateTermMapToStringArray(longReferenceCandidateTerms), ["Recall", "Precision", "Keywords"])
        ];

        // const summary4 = [
        //     buildSummaryAnalysisResult(shortReference, "NP Chunks and Named Entity", shortBestSummary.summary, ["Recall", "Precision", "Keywords"]),
        //     buildSummaryAnalysisResult(mediumReference, "NP Chunks and Named Entity", shortBestSummary.summary, ["Recall", "Precision", "Keywords"]),
        //     buildSummaryAnalysisResult(longReference, "NP Chunks and Named Entity", shortBestSummary.summary, ["Recall", "Precision", "Keywords"]),

        // ];
        // Return Summaries
        return JSON.parse(JSON.stringify(combineSummaries(summary1.concat(summary2, summary3))));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Analyze a conversation stored in the application corpus
 * @param documentId Document ID of conversation
 * @returns {JSON} JSON to display results
 */
export async function analyzeCorpusConversation(documentId: string): Promise<JSON> {
    try {
        logger.info(`analyzeCorpusConversation()...`);
        const document = await CorpusDocumentModel.findById(mongoose.Types.ObjectId(documentId));
        const annotated = CoreNLP.simple.Document.fromJSON(document.processedText);
        const conversation: Conversation  = {
            speakers: document.speakers,
            raw: document.rawText,
            annotated
        };
        const shortReference: Reference = {
            name: "Short Summary",
            summary: document.referenceSummaries.short,
            annotated: await annotate(document.referenceSummaries.short)
        };
        const mediumReference  = {
            name: "Medium Summary",
            summary: document.referenceSummaries.medium,
            annotated: await annotate(document.referenceSummaries.medium)
        };
        const longReference  = {
            name: "Long Summary",
            summary: document.referenceSummaries.long,
            annotated: await annotate(document.referenceSummaries.long)
        };
        // const CorpusCandidateTermTFIDFSummary
        // const summary1 = await new CorpusLemmaTFIDFSummary(conversation, [shortReference, mediumReference, longReference], document.keywords).summarize();
        // const summary2 = await new CorpusCandidateTermTFIDFSummary(conversation, [shortReference, mediumReference, longReference], document.keywords).summarize();
        // const summary3 = await new LatentDirichletAllocationSummary(conversation, [shortReference, mediumReference, longReference], document.keywords).summarize();
       //  return JSON.parse(JSON.stringify(combineSummaries(summary1.concat(summary2))));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Group generated summaries by which reference summary they refer to
 * @param {Array<GeneratedSummary>} summaries Array of generated summaries
 * @returns {Array<FinalSummary} Grouped summaries ready to be transformed to JSON
 */
function combineSummaries(summaries: Array<GeneratedSummary>): Array<FinalSummary> {
    // Build map of (summary type) => (summary)
    const summaryTypeMap = new Map <string, Array<GeneratedSummary>>();
    summaries.forEach((summary) => {
        if (summaryTypeMap.has(summary.reference.name)) {
            summaryTypeMap.get(summary.reference.name).push(summary);
        }
        else {
            summaryTypeMap.set(summary.reference.name, new Array<GeneratedSummary>(summary));
        }
    });
    // Return as Array<FinalSummary>
    return [...summaryTypeMap.entries()].map(([type, generatedSummary]) => {
        return {
            reference: {
                name: type,
                summary: generatedSummary[0].reference.summary
            },
            generated: generatedSummary
        };
    });
}

function buildSummaryAnalysisResult(reference: Reference, method: string, candidateSummary: Array<string>, referenceSummary: Array<string>, metrics: Array<MetricTypes>): GeneratedSummary {
    return {
        reference,
        method,
        summary: buildSummaryTermArray(candidateSummary.join(", "), reference.summary),
        scores: calculateAllScores(candidateSummary, referenceSummary, metrics)
    };
}

/*
export type  GeneratedSummary = {
    reference: Reference,
    method: string,
    summary: Array<SummaryTerm>,
    scores: Array<SummaryMetric>
};
*/

export function buildSummaryTermArray(generated: string, reference: string): Array<SummaryTerm> {
    return new Array<SummaryTerm>();
    // return generated.map((term) => {
    //     const match = new RegExp("\\b" + term + "\\b", "i").test(reference);
    //     return {
    //         term,
    //         match
    //     };
    // });
}

function lemmaMapToStringArray(map: Map<string, number>): Array<string> {
    return [...map.keys()];
}

function candidateTermMapToStringArray(map: Map<string, number>): Array<string> {
    return [...map.keys()].map((termString) => CandidateTerm.fromString(termString).term);
}

function namedEntityMapToStringArray(map: Map<string, number>): Array<string> {
    return [...map.keys()].map((termString) => NamedEntityTerm.fromString(termString).term);
}

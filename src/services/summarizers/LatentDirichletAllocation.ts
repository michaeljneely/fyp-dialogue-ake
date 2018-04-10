import _ = require("lodash");
import * as mongoose from "mongoose";
import { ExtractedCandidateTerm, ExtractedCandidateTermMap } from "../../models/CandidateTerm";
import { Conversation } from "../../models/Conversation";
import { CorpusDocumentModel } from "../../models/CorpusDocument";
import { Reference } from "../../models/Reference";
import { buildSummaryTermArray, GeneratedSummary, Summary } from "../../models/Summary";
import { UserDocumentModel } from "../../models/UserDocument";
import { normalizeStringArray, reduceNumberInRange, shuffle } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, calculateWeightedTFUIDF } from "../metrics/tfidf";
import { candidateTermIDFCorpus, candidateTermIDFUser } from "../metrics/tfidf";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { topicise } from "../processors/lda";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "../processors/lemma";
import { candidateTermTFIDFSummary, CorpusCandidateTermTFIDFSummary } from "./CandidateTermTFIDF";

interface TermWithTFIDF {
    term: string;
    tfidf: number;
}

export class LatentDirichletAllocationSummary extends Summary {

    constructor(conversation: Conversation, references: Array<Reference>, keywords: Array<string>) {
        super(conversation, references, keywords);
        this.summaryMethod = "LatentDirichletAllocationSummary";
    }

    public async summarize(): Promise<GeneratedSummary[]> {
        try {
            const candidateTerms = extractCandidateTermsFromCoreNLPDocument(this.conversation.annotated);
            const generatedSummaries = this.references.map(async (reference, index) => {
                const referenceCandidateTerms = extractCandidateTermsFromCoreNLPDocument(reference.annotated);
                const topicCount = Math.ceil(candidateTerms.size() / 10);
                const wordsPerTopic = Math.ceil(referenceCandidateTerms.size() / topicCount);
                const ldaTopics = await topicise(candidateTerms.toStringArray(), topicCount);
                let candidateLDASummary: Array<string> = [];
                ldaTopics.forEach((topic) => {
                    candidateLDASummary = candidateLDASummary.concat(topic.slice(0, wordsPerTopic));
                });
                if (candidateLDASummary.length > referenceCandidateTerms.size()) {
                    candidateLDASummary = shuffle(candidateLDASummary).slice(0, referenceCandidateTerms.size() - candidateLDASummary.length);
                }
                const corpusTFIDFSummary = await candidateTermTFIDFSummary(candidateTerms, referenceCandidateTerms.size());
                const referenceSummaryArray = referenceCandidateTerms.toStringArray();
                const referenceSummaryLowerCase = reference.summary.toLowerCase();
                const candidateSummary = corpusTFIDFSummary.slice(0, Math.floor(candidateLDASummary.length / 2)).concat(candidateLDASummary.slice(0, Math.floor(candidateLDASummary.length / 2))).slice(0, referenceSummaryArray.length);
                return {
                    reference,
                    method: this.summaryMethod,
                    summary: buildSummaryTermArray(candidateSummary, referenceSummaryLowerCase),
                    scores: calculateAllScores(candidateSummary, referenceSummaryArray, 2),
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

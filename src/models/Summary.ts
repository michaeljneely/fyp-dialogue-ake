import * as mongoose from "mongoose";
import { Conversation } from "../models/Conversation";
import { Reference } from "../models/Reference";
import { TermWithFinalScore } from "./Term";

// An array of these objects is formatted by the 'results' template
export type FinalSummary = {
    reference: {
        name: string,
        summary: string
    };
    generated: Array<GeneratedSummary>,
};


// Object that shows combines all aspects of a summary generated by the application
export type  GeneratedSummary = {
    reference: Reference,
    method: string,
    summary: Array<SummaryTerm>,
    scores: Array<SummaryMetric>
};

// Object that expresses a summary metric and its corresponding score
export type SummaryMetric = {
    method: string,
    score: string
};

// Used by 'results' template to display terms in the generated summary that match the reference summary
export type SummaryTerm = {
    match: boolean,
    term: string
};

export interface ISummary {
    method: string;
    summary: Array<string>;
    lemmas?: Map<string, number>;
    candidateTerms?: Map<string, number>;
    namedEntities?: Map<string, number>;
    rankedKeyphrases?: Array<TermWithFinalScore>;
}

/**
 * Helper function that generates an Array of Summary Term objects that are used by the 'results' template to show matches
 * @param {Array<string>} generated Generated Summary terms
 * @param {string} reference User-provided reference summaries
 */

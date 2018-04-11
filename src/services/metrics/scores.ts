import _ = require("lodash");
import { MetricTypes } from "../../models/Metrics";
import { SummaryMetric } from "../../models/Summary";
import { normalizeStringArray } from "../../utils/functions";
export function calculateAllScores(candidate: Array<string>, reference: Array<string>, metrics: Array<MetricTypes>, decimalPlaces: number = 2, keywords?: Array<string>): Array<SummaryMetric> {
    const results = new Array<SummaryMetric>();

    if (metrics.indexOf("Recall") !== -1) {
        results.push({
            method: "Recall",
            score: recall(candidate, reference).toPrecision(decimalPlaces)
        });
    }
    if (metrics.indexOf("Precision") !== -1) {
        results.push({
            method: "Precision",
            score: precision(candidate, reference).toPrecision(decimalPlaces)
        });
    }
    if (metrics.indexOf("Rouge-1") !== -1) {
        results.push({
            method: "Rouge-1",
            score: rougeN(candidate, reference, 1).toPrecision(decimalPlaces)
        });
    }
    if (metrics.indexOf("Rouge-2") !== -1) {
        results.push({
            method: "Rouge-2",
            score: rougeN(candidate, reference, 2).toPrecision(decimalPlaces)
        });
    }
    if (metrics.indexOf("Keywords") !== -1) {
        results.push({
            method: "Keywords",
            score: compareKeywords(candidate, reference).toPrecision(decimalPlaces)
        });
    }
    return results;
}

export function recall(candidate: Array<string>, reference: Array<string>): number {
    const intersection = _.intersection(normalizeStringArray(candidate), normalizeStringArray(reference));
    return intersection.length / reference.length;
}

export function precision(candidate: Array<string>, reference: Array<string>): number {
    const intersection = _.intersection(normalizeStringArray(candidate), normalizeStringArray(reference));
    return intersection.length / candidate.length;
}

/*
Rouge Metric
    - Compare a machine produced summary against a human produced reference summary
    - Scores
        - N: Overlap of N-grams between the system and reference summaries.
        - L: Longest common subsequence
        - S: Skip bigram
*/

export function nGrams(terms: Array<string>, n: number): Array<Array<string>> {
    const result = new Array<Array<string>>();

    const count = _.max([0, terms.length - n + 1]);

    for (let i = 0; i < count; i++) {
        result.push(terms.slice(i, i + n));
    }

    return result;
}

/**
 * Calculate Rouge N Score
 * @param reference
 * @param candidate
 * @param n
 */
export function rougeN(candidate: Array<string>, reference: Array<string>, n: number): number {
    const candidateNGrams = nGrams(candidate, n).map((nGram) => nGram.join(" "));
    const referenceNGrams = nGrams(reference, n).map((nGram) => nGram.join(" "));
    const matches = _.intersection(normalizeStringArray(candidateNGrams), normalizeStringArray(referenceNGrams));
    return matches.length / referenceNGrams.length;
}

export function compareKeywords(candidate: Array<string>, reference: Array<string>): number {
    return 1;
}

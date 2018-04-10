import * as _ from "lodash";
import { SummaryMetric } from "../../models/Summary";
import { normalizeStringArray } from "../../utils/functions";
import { logger } from "../../utils/logger";

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
export function rougeN(reference: Array<string>, candidate: Array<string>, n: number): number {
    const candidateNGrams = nGrams(candidate, n).map((nGram) => nGram.join(" "));
    const referenceNGrams = nGrams(reference, n).map((nGram) => nGram.join(" "));
    // logger.info(`candidate: `);
    // candidateNGrams.forEach((candidate) => logger.info(candidate));
    // logger.info(`reference: `);
    // referenceNGrams.forEach((reference) => logger.info(reference));
    const matches = _.intersection(normalizeStringArray(candidateNGrams), normalizeStringArray(referenceNGrams));
    // logger.info(`matches: `);
    // matches.forEach((match) => logger.info(match));
    return matches.length / referenceNGrams.length;
}

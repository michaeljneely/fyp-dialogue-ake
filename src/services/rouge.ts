import { l, n, s } from "rouge";

/*
Rouge Metric
    - Compare a machine produced summary against a human produced reference summary
    - Scores
        - N: Overlap of N-grams between the system and reference summaries.
        - L: Longest common subsequence
        - S: Skip bigram
*/

/**
 * Get Rouge N score
 * @param {string} candidate Candidate string
 * @param {string} reference Reference string
 * @returns {number} rougeN score
 */
export function rougeN(candidate: string, reference: string): number {
    return n(candidate, reference, undefined);
}

/**
 * Get Rouge L score
 * @param {string} candidate Candidate string
 * @param {string} reference Reference string
 * @returns {number} rougeL score
 */
export function rougeL(candidate: string, reference: string): number {
    return l(candidate, reference, undefined);
}

/**
 * Get Rouge S score
 * @param {string} candidate Candidate string
 * @param {string} reference Reference string
 * @returns {number} rougeS score
 */
export function rougeS(candidate: string, reference: string): number {
    return s(candidate, reference, undefined);
}

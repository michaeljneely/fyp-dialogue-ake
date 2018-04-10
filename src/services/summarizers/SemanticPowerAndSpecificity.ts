import CoreNLP from "corenlp";
import * as _ from "lodash";
import { Reference } from "../../models/Reference";
import { buildSummaryTermArray, GeneratedSummary } from "../../models/Summary";
import { normalizeStringArray, reduceNumberInRange, sleep } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { getCountInCoreNLPDocument } from "../corenlp/corenlp";
import { calculateAllScores } from "../metrics/scores";
import { calculateTFIDF, candidateTermIDFCorpus, lemmaIDFCorpus } from "../metrics/tfidf";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { getDBpediaScore } from "../processors/dbpedia";
import { topicise } from "../processors/lda";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "../processors/lemma";
import { extractNamedEntitiesFromCoreNLPDocument } from "../processors/namedEntities";
import { CorpusCandidateTermTFIDFSummary } from "./CandidateTermTFIDF";

// Necessary for term sorting and processing
interface TermWithMetrics {
    term: string;
    tfidf: number;
    specificity: number;
}

// Necessary for term sorting and processing
interface TermWithScore {
    term: string;
    score: number;
}


/**
 * A
 * @param numberOfWords
 * @param reference
 * @param k
 */
export async function semanticPowerAndSpecificitySummary(annotated: CoreNLP.simple.Document, numberOfWords: number, k: number): Promise<Array<string>> {

        // Custom comparator function for summary
    function _decomposedIntersection(a: string, b: string): boolean {
        if (a && b) {
            if (a === b) return true;
            else {
                const decomposedA = a.split(" ");
                const decomposedB = b.split(" ");
                const aInB = decomposedA.filter((val) => decomposedB.indexOf(val) !== -1);
                const bInA = decomposedB.filter((val) => decomposedA.indexOf(val) !== -1);
                return (bInA.length > 0 || aInB.length > 0);
            }
        }
        else {
            return false;
        }
    }

    try {
        logger.info(`semanticPowerAndSpecificitySummary() called with ${numberOfWords} words`);
        // Extract Candidate Terms
        const candidateTerms = extractCandidateTermsFromCoreNLPDocument(annotated);

        // Extract Named Entities
        const namedEntities = extractNamedEntitiesFromCoreNLPDocument(annotated).map((entity => entity.term));

        // Early termination
        if (_.isEmpty(namedEntities) && _.isEmpty(candidateTerms.toStringArray())) {
            return [annotated.toString()];
        }

        // Get Union of decomposed intersection of named entities with Candidate Terms
        const nonCandidateTermsToExamine = _.difference(_.intersectionWith(namedEntities, candidateTerms.toStringArray(), _decomposedIntersection), candidateTerms.toStringArray());

        // Get TFIDF and Specificity scores of Candidate Terms
        const candidateTermsWithMetrics = await Promise.all(candidateTerms.store().map(async (ct): Promise<TermWithMetrics> => {
            const idf = await candidateTermIDFCorpus(ct["0"]);
            const tfidf = calculateTFIDF(ct["1"], idf);
            const specificity = await getDBpediaScore(ct["0"].term);
            return {
                term: ct["0"].term,
                tfidf,
                specificity
            } as TermWithMetrics;
        }));

        // Get TFIDF and Specificity scores of Non Candidate Terms
        const nonCandidateTermsWithMetrics = await Promise.all(nonCandidateTermsToExamine.map(async (nct): Promise<TermWithMetrics> => {
            const individualWords = nct.split(" ");
            let tfidf: number = 0;
            if (individualWords.length > 1) {
                const tfidfs = new Array<number>();
                for (const word of individualWords) {
                    const tf = getCountInCoreNLPDocument(word, annotated);
                    const idf = await lemmaIDFCorpus(word);
                    const tfidf = calculateTFIDF(tf, idf);
                    tfidfs.push(tfidf);
                }
                tfidf = _.sum(tfidfs) / tfidfs.length;
            }
            else {
                const tf = getCountInCoreNLPDocument(nct, annotated);
                const idf = await lemmaIDFCorpus(nct);
                tfidf = calculateTFIDF(tf, idf);
            }
            const specificity = await getDBpediaScore(nct);
            return {
                term: nct,
                tfidf,
                specificity
            } as TermWithMetrics;
        }));

        // Combine CandidateTerms and Non - Candidate Terms
        const allTermsWithMetrics = await candidateTermsWithMetrics.concat(nonCandidateTermsWithMetrics);

        if (allTermsWithMetrics.length > numberOfWords) {
            // Descending sort on TFIDF
            const tfidfSort = allTermsWithMetrics.sort((t1, t2) => {
                if (t1.tfidf > t2.tfidf ) {
                    return -1;
                }
                else if (t1.tfidf < t2.tfidf) {
                    return 1;
                }
                else return 0;
            });

            // Average both metrics (range 0 - 1)
            const maxTFIDF = tfidfSort[0].tfidf;
            const minTFIDF = 0;
            const allTermsWithScore: Array<TermWithScore> = allTermsWithMetrics.map((termWithMetrics) => {
                return {
                    term: termWithMetrics.term,
                    score: calculateCombinedScore(reduceNumberInRange(termWithMetrics.tfidf, maxTFIDF, minTFIDF), termWithMetrics.specificity, k),
                } as TermWithScore;
            });

            // Descending sort on score
            const scoreSort = allTermsWithScore.sort((t1, t2) => {
                if (t1.score > t2.score ) {
                    return -1;
                }
                else if (t1.score < t2.score) {
                    return 1;
                }
                else return 0;
            });

            // Now remove words that are too similar
            logger.info(`let's remove words that are too similar here...`);

            // Extract terms and return
            const summary = scoreSort.map((n) => n.term);
            return (numberOfWords >= scoreSort.length) ? summary : summary.slice(0, numberOfWords - 1);
        }
        else {
            return allTermsWithMetrics.map((n) => n.term);
        }
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

export function semanticPowerAndSpecificitySummaryWithScores(maxLengthSummary: Array<string>, reference: Reference): GeneratedSummary {
    const a = extractCandidateTermsFromCoreNLPDocument(reference.annotated).toStringArray();
    const b = extractNamedEntitiesFromCoreNLPDocument(reference.annotated).map((namedEntity) => namedEntity.term);
    const referenceTerms  = _.union(a, b);
    const summary = maxLengthSummary.slice(0, referenceTerms.length);
    return {
        reference,
        method: "NPChunkSemanticPowerAndSpecificity",
        summary: buildSummaryTermArray(summary, reference.summary.toLowerCase()),
        scores: calculateAllScores(summary, referenceTerms)
    };
}

export function calculateCombinedScore(tfidf: number, specificity: number, k: number): number {
    return ((k * tfidf) - ((1 - k) * specificity));
}

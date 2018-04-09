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
        // Extract Candidate Terms
        const candidateTerms = extractCandidateTermsFromCoreNLPDocument(annotated);
        // Extract Named Entities
        const namedEntities = extractNamedEntitiesFromCoreNLPDocument(annotated).map((entity => entity.term));
        // Extract top 3 words from each topic
        const initialNumberOfTopics = 10;
        const ldaTopics = await topicise(candidateTerms.toStringArray(), initialNumberOfTopics);
        const topics = ldaTopics.map((topic) => normalizeStringArray(topic.slice(0, 3)));
        // Get Union between topics & named entities
        const extraTerms = _.union(...topics, namedEntities);
        // Get Union of decomposed intersection with Candidate Terms
        const nonCandidateTermsToExamine = _.difference(_.intersectionWith(extraTerms, candidateTerms.toStringArray(), _decomposedIntersection), candidateTerms.toStringArray());

        // Get TFIDF and Specificity scores of Candidate Terms
        const candidateTermsWithMetrics = await Promise.all(candidateTerms.store().map(async (ct): Promise<TermWithMetrics> => {
            const idf = await candidateTermIDFCorpus(ct["0"]);
            const tfidf = calculateTFIDF(ct["1"], idf);
            const specificity = await getDBpediaScore(ct["0"].term);
            return Promise.resolve({
                term: ct["0"].term,
                tfidf,
                specificity
            } as TermWithMetrics);
        }));

        // Get TFIDF and Specificity scores of Non Candidate Terms
        const nonCandidateTermsWithMetrics = await Promise.all(nonCandidateTermsToExamine.map(async (nct): Promise<TermWithMetrics> => {
            const individualWords = nct.split(" ");
            if (individualWords.length > 0) {
                const tfidfs: Array<number> = await Promise.all(individualWords.map(async (word): Promise<number> => {
                    const tf = getCountInCoreNLPDocument(word, annotated);
                    const idf = await lemmaIDFCorpus(word);
                    const tfidf = calculateTFIDF(tf, idf);
                    return tfidf;
                }));
                const specificities: Array<number> = await Promise.all(individualWords.map(async (word): Promise<number> => {
                    // DBpedia gets angry if you query to fast
                    await sleep(500);
                    logger.info("sleeping for 1/2 second");
                    return await getDBpediaScore(word);
                }));
                return Promise.resolve({
                    term: nct,
                    tfidf: _.sum(tfidfs) / tfidfs.length,
                    specificity:  _.sum(specificities) / specificities.length
                } as TermWithMetrics);
            }
            else {
                const tf = getCountInCoreNLPDocument(nct, annotated);
                const idf = await lemmaIDFCorpus(nct);
                const tfidf = calculateTFIDF(tf, idf);
                const specificity = await getDBpediaScore(nct);
                return Promise.resolve({
                    term: nct,
                    tfidf,
                    specificity
                } as TermWithMetrics);
            }
        }));

        // Combine CandidateTerms and Non - Candidate Terms
        const allTermsWithMetrics = await candidateTermsWithMetrics.concat(nonCandidateTermsWithMetrics);

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
                score: calculateCombinedScore(termWithMetrics.specificity, reduceNumberInRange(termWithMetrics.tfidf, maxTFIDF, minTFIDF), k),
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

        // Extract terms and return
        const summary = scoreSort.map((n) => n.term);
        return (numberOfWords >= scoreSort.length) ? summary : summary.slice(0, numberOfWords - 1);
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

export function semanticPowerAndSpecificitySummaryWithScores(maxLengthSummary: Array<string>, reference: Reference): GeneratedSummary {
    const a = extractCandidateTermsFromCoreNLPDocument(reference.annotated).toStringArray();
    const b = extractNamedEntitiesFromCoreNLPDocument(reference.annotated).map((namedEntity) => namedEntity.term);
    const c = _.union(a, b).length;
    const referenceTerms = [...extractMeaningfulLemmasFromCoreNLPDocument(reference.annotated).keys()];
    const summary = maxLengthSummary.slice(0, c - 1);
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

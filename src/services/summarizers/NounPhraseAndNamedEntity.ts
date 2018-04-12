import CoreNLP from "corenlp";
import _ = require("lodash");
import * as mongoose from "mongoose";
import { CandidateTerm } from "../../models/CandidateTerm";
import { NamedEntityTerm } from "../../models/NamedEntityTerm";
import { ISummary } from "../../models/Summary";
import { Term } from "../../models/Term";
import { reduceNumberInRange } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { termIDFCorpus } from "../metrics/tfidf";
import { getDBpediaScore } from "../processors/dbpedia";
const stringSimilarity = require("string-similarity");

interface TermWithFinalScore {
    term: Term;
    finalScore: number;
}

interface TermWithScoreAndTFIDF {
    term: Term;
    score: number;
    tfidf: number;
}

export async function npAndNERSummary(annotated: CoreNLP.simple.Document, candidateTermMap: Map<string, number>, namedEntityMap: Map<string, number>, numberOfWords: number, userId?: mongoose.Types.ObjectId): Promise<ISummary> {

    const namedEntityFilter = ["PERSON", "LOCATION", "ORGANIZATION", "NATIONALITY", "COUNTRY", "STATE_OR_PROVENCE", "TITLE", "IDEOLOGY", "RELIGION", "CRIMINAL_CHARGE", "CAUSE_OF_DEATH"];
    const importNamedEntityFilter = ["PERSON"];

    function _returnAsSummary(summary: Array<string>, lemmas?: Map<string, number>, candidateTerms?: Map<string, number>, namedEntities?: Map<string, number>): ISummary {
        return {
            method: "NounPhrase Chunks & Named Entities",
            summary,
            lemmas: lemmas || undefined,
            candidateTerms: candidateTerms || undefined,
            namedEntities: namedEntities || undefined,
        };
    }

    function _namedEntityAndCandidateTermComparator(t1: Term, t2: Term): boolean {
        if (t1 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(t1.type) === -1;
        }
        else if (t2 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(t2.type) === -1;
        }
        else {
            return t1.term === t2.term;
        }
    }

    async function _processDBP(arr: Array<Term>): Promise<Array<Term>> {
        logger.info(`processing dbpedia...`);
        const ret = new Array<Term>();
        for (let i = 0; i < arr.length; i++) {
            const term = arr[i];
            if (term instanceof CandidateTerm && term.term.length > 1) {
                const score = await getDBpediaScore(term.term);
                if (score > 0.5) {
                    ret.push(term);
                }
            }
            else if (term instanceof NamedEntityTerm) {
                ret.push(term);
            }
        }
        return ret;
    }

    try {
        const k = 0.75;

        logger.info(`npAndNERSummary() called with request to return ${numberOfWords} words...`);

        // Extract Candidate Terms
        const candidateTermKeys = [...candidateTermMap.keys()].map((key) => CandidateTerm.fromString(key));

        // Extract Named Entities
        const namedEntityKeys = [...namedEntityMap.keys()].map((key) => NamedEntityTerm.fromString(key));

        logger.info(`Candidate Terms and Named Entities Extracted: ${candidateTermKeys.length + namedEntityKeys.length} total terms to consider`);

        // Early termination
        if (_.isEmpty(namedEntityKeys) && _.isEmpty(candidateTermKeys)) {
            logger.info(`No named Entities or Candidate terms. Returning early...`);
            return _returnAsSummary(annotated.toString().split(", "));
        }

        // Custom Union - Remove Candidate Terms that are identical to Named Entities
        const unifiedTerms: Array<Term> = _.unionWith(namedEntityKeys, candidateTermKeys, _namedEntityAndCandidateTermComparator);
        logger.info(`Terms unified. Considering: ${unifiedTerms.length} unique terms.`);

        // Remove all terms that are too similar - Use Sørensen–Dice coefficient
        const termsToRemove = new Array<string>();
        const alreadyChecked = new Array<string>();
        for (let i = 0; i < unifiedTerms.length; i++) {
            const rest = unifiedTerms.slice(0, i).concat((unifiedTerms.slice(i + 1, unifiedTerms.length)));
            const t1 = unifiedTerms[i];
            for (let j = 0; j < rest.length; j++) {
                const t2 = rest[j];
                if (alreadyChecked.indexOf(Term.toString(t1)) === -1 && termsToRemove.indexOf(Term.toString(t2)) === -1 && termsToRemove.indexOf(Term.toString(t1)) === -1) {
                    if (stringSimilarity.compareTwoStrings(t1.term, t2.term) > 0.75) {
                        if ((t1 instanceof NamedEntityTerm) && (t2 instanceof CandidateTerm)) {
                            termsToRemove.push(Term.toString(t2));
                        }
                        else if ((t2 instanceof NamedEntityTerm) && (t1 instanceof CandidateTerm)) {
                            termsToRemove.push(Term.toString(t2));
                        }
                        else {
                            (t1.term.length > t2.term.length) ? termsToRemove.push(Term.toString(t1)) : termsToRemove.push(Term.toString(t2));
                        }
                    }
                }
            }
            alreadyChecked.push(Term.toString(t1));
        }
        const termsToConsider = unifiedTerms.filter((term) => termsToRemove.indexOf(Term.toString(term)) === -1);
        logger.info(`removed ${unifiedTerms.length - termsToConsider.length} terms.`);
        logger.info(`Examining the remaining: ${termsToConsider.length} unique terms`);

        // Early Exit Condition 2;
        if (termsToConsider.length < numberOfWords) {
            // TOTO
            return _returnAsSummary(termsToConsider.map((ttc) => ttc.term));
        }

        logger.info(`Beginning to query DBpedia to remove vague Candidate Terms`);
        const termScores = new Array<TermWithScoreAndTFIDF>();
        let ectTFIDFTotal: number = 0;
        let ectCount: number = 0;
        let neTFIDFTotal: number = 0;
        let neCount: number = 0;
        let neTFIDFMax: number = 0;
        let ectTFIDFMax: number = 0;
        let neTFIDFMin: number = 0;
        let ectTFIDFMin: number = 0;
        for (let i = 0; i < termsToConsider.length; i++) {
            const term = termsToConsider[i];
            if (term instanceof CandidateTerm && term.term.length > 1) {
                const score = await getDBpediaScore(term.term);
                const tf = candidateTermMap.get(Term.toString(term));
                const idf = await termIDFCorpus(term);
                const tfidf = tf * idf;
                if (tfidf > ectTFIDFMax) {
                    ectTFIDFMax = tfidf;
                }
                if (tfidf < ectTFIDFMin) {
                    ectTFIDFMin = tfidf;
                }
                ectTFIDFTotal += tfidf;
                ectCount++;
                termScores.push({term, tfidf, score});
            }
            else if (term instanceof NamedEntityTerm) {
                const score = await getDBpediaScore(term.term);
                const tf = namedEntityMap.get(Term.toString(term));
                const idf = await termIDFCorpus(term);
                const tfidf = tf * idf;
                if (tfidf > neTFIDFMax) {
                    neTFIDFMax = tfidf;
                }
                if (tfidf < neTFIDFMin) {
                    neTFIDFMin = tfidf;
                }
                neTFIDFTotal += tfidf;
                neCount++;
                termScores.push({term, tfidf, score});
            }
        }
        let scoreTotal: number = 0;
        const rankedList: Array<TermWithFinalScore> = termScores.map((tws) => {
            if (tws.term instanceof CandidateTerm) {
                const finalScore = ((k * reduceNumberInRange(tws.tfidf, ectTFIDFMax, ectTFIDFMin)) + ((1 - k) * tws.score));
                scoreTotal += finalScore;
                return {
                    term: tws.term,
                    finalScore
                };
            }
            else if (tws.term instanceof NamedEntityTerm) {
                const finalScore = (importNamedEntityFilter.indexOf(tws.term.type) !== -1) ? 1 : ((k * reduceNumberInRange(tws.tfidf, ectTFIDFMax, ectTFIDFMin)) + ((1 - k) * tws.score));
                scoreTotal += finalScore;
                return {
                    term: tws.term,
                    finalScore
                };
            }
        });
        const averageTotalScore = scoreTotal / rankedList.length;
        const finalTermsToConsider = rankedList.filter((tws) => {
            return tws.finalScore >= averageTotalScore;
        }).sort((a, b) => {
            if (a.finalScore > b.finalScore) {
                return -1;
            }
            else if (a.finalScore < b.finalScore) {
                return 1;
            }
            else return 0;
        });
        const termsToRemove2 = new Array<string>();
        const alreadyChecked2 = new Array<string>();
        for (let i = 0; i < finalTermsToConsider.length; i++) {
            const rest = finalTermsToConsider.slice(0, i).concat((finalTermsToConsider.slice(i + 1, finalTermsToConsider.length)));
            const t1 = finalTermsToConsider[i];
            for (let j = 0; j < rest.length; j++) {
                const t2 = rest[j];
                if (alreadyChecked2.indexOf(t1.term.term) === -1 && termsToRemove2.indexOf(t2.term.term) === -1 && termsToRemove2.indexOf(t1.term.term) === -1) {
                    if (stringSimilarity.compareTwoStrings(t1.term.term, t2.term.term) > 0.60) {
                        (t1.finalScore > t2.finalScore) ? termsToRemove2.push(t2.term.term) : termsToRemove2.push(t1.term.term);
                    }
                }
            }
            alreadyChecked2.push(t1.term.term);
        }
        const okayReallyFinalThisTime = finalTermsToConsider.filter((term) => termsToRemove2.indexOf(term.term.term) === -1);
        return _returnAsSummary(okayReallyFinalThisTime.slice(0, numberOfWords).map((twt) => {
            logger.info(twt.term.term);
            return twt.term.term;
        }));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

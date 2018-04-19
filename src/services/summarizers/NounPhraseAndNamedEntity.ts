import CoreNLP from "corenlp";
import _ = require("lodash");
import * as mongoose from "mongoose";
import { stopwords } from "../../constants/filters";
import { CandidateTerm } from "../../models/CandidateTerm";
import { NamedEntityTerm } from "../../models/NamedEntityTerm";
import { ISummary } from "../../models/Summary";
import { Term, TermWithFinalScore } from "../../models/Term";
import { reduceNumberInRange } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { calculateWeightedTFUIDF, termIDFCorpus, termIDFUser } from "../metrics/tfidf";
import { getDBpediaScore } from "../processors/dbpedia";
const stringSimilarity = require("string-similarity");
import * as fs from "fs-extra";

interface TermWithDBpediaScore {
    term: Term;
    dbpediaScore: number;
}

interface TermWithScoreAndTFIDF {
    term: Term;
    dbpediaScore: number;
    tfidf: number;
}

export async function npAndNERSummary(annotated: CoreNLP.simple.Document, candidateTermMap: Map<string, number>, namedEntityMap: Map<string, number>, numberOfWords: number, userId?: mongoose.Types.ObjectId): Promise<ISummary> {

    const namedEntityFilter = ["PERSON", "LOCATION", "ORGANIZATION", "NATIONALITY", "COUNTRY", "STATE_OR_PROVENCE", "TITLE", "IDEOLOGY", "RELIGION", "CRIMINAL_CHARGE", "CAUSE_OF_DEATH", "MISC"];
    const importNamedEntityFilter = ["PERSON"];

    function _returnAsSummary(summary: Array<string>, lemmas?: Map<string, number>, candidateTerms?: Map<string, number>, namedEntities?: Map<string, number>, rankedKeyphrases?: Array<TermWithFinalScore>): ISummary {
        return {
            method: "NounPhrase Chunks & Named Entities",
            summary,
            lemmas: lemmas || undefined,
            candidateTerms: candidateTerms || undefined,
            namedEntities: namedEntities || undefined,
            rankedKeyphrases
        };
    }

    function _namedEntityAndCandidateTermComparator(t1: Term, t2: Term): boolean {
        if (t1 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(t1.type) === -1;
        }
        else if (t2 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(t2.type) === -1;
        }
        return t1.term === t2.term;
    }

    async function _processDBP(arr: Array<Term>): Promise<Array<TermWithDBpediaScore>> {
        logger.info(`processing dbpedia...`);
        const start = Date.now();
        const ret = new Array<TermWithDBpediaScore>();
        for (let i = 0; i < arr.length; i++) {
            const term = arr[i];
            logger.info(`Time is ${Date.now() - start}`);
            if (Date.now() - start > 80000) {
                return Promise.reject("timeout");
            }
            if (term && term.term && term.term.length > 1) {
                const dbpediaScore = await getDBpediaScore(term.term);
                ret.push({
                    term,
                    dbpediaScore
                });
            }
        }
        return ret;
    }

    try {
        const gamma = 0.5;
        const delta = 0.5;

        logger.info(`npAndNERSummary() called with request to return ${numberOfWords} words...`);

        // Extract Candidate Terms
        // Check for undefined?
        const candidateTermKeys = [...candidateTermMap.keys()].map((key) => CandidateTerm.fromString(key)).filter((ct) => (stopwords.indexOf(ct.term) === -1));

        // Extract Named Entities
        // Check for undefined?
        const namedEntityKeys = [...namedEntityMap.keys()].map((key) => NamedEntityTerm.fromString(key)).filter((nek) => (namedEntityFilter.indexOf(nek.entityType) !== -1) && (stopwords.indexOf(nek.term) === -1));

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
            return _returnAsSummary(termsToConsider.map((ttc) => ttc.term));
        }
        logger.info(`Beginning to query DBpedia to remove vague Candidate Terms`);
        const ttcWithScores = await _processDBP(termsToConsider);
        const termScores = new Array<TermWithScoreAndTFIDF>();
        let ectTFIDFTotal: number = 0;
        let ectCount: number = 0;
        let neTFIDFTotal: number = 0;
        let neCount: number = 0;
        let neTFIDFMax: number = 0;
        let ectTFIDFMax: number = 0;
        let neTFIDFMin: number = 0;
        let ectTFIDFMin: number = 0;
        for (let i = 0; i < ttcWithScores.length; i++) {
            const term = ttcWithScores[i];
            if (term.term instanceof CandidateTerm) {
                const tf = candidateTermMap.get(Term.toString(term.term));
                let tfidf = 0;
                const cIdf = await termIDFCorpus(term.term);
                if (userId) {
                    const uIdf = await termIDFUser(userId, term.term);
                    tfidf = calculateWeightedTFUIDF(tf, cIdf, uIdf, delta);
                }
                else {
                    tfidf = tf * cIdf;
                }
                if (tfidf > ectTFIDFMax) {
                    ectTFIDFMax = tfidf;
                }
                if (tfidf < ectTFIDFMin) {
                    ectTFIDFMin = tfidf;
                }
                ectTFIDFTotal += tfidf;
                ectCount++;
                termScores.push({term: term.term, tfidf, dbpediaScore: term.dbpediaScore});
            }
            else if (term.term instanceof NamedEntityTerm) {
                const tf = namedEntityMap.get(Term.toString(term.term));
                const cIdf = await termIDFCorpus(term.term);
                let tfidf = 0;
                if (userId) {
                    const uIdf = await termIDFUser(userId, term.term);
                    const tfidf = calculateWeightedTFUIDF(tf, cIdf, uIdf, delta);
                }
                else {
                    tfidf = tf * cIdf;
                }
                if (tfidf > neTFIDFMax) {
                    neTFIDFMax = tfidf;
                }
                if (tfidf < neTFIDFMin) {
                    neTFIDFMin = tfidf;
                }
                neTFIDFTotal += tfidf;
                neCount++;
                termScores.push({term: term.term, tfidf, dbpediaScore: term.dbpediaScore});
            }
        }
        let scoreTotal: number = 0;
        const rankedList: Array<TermWithFinalScore> = termScores.map((tws) => {
            if (tws.term instanceof CandidateTerm) {
                const finalScore = ((gamma * reduceNumberInRange(tws.tfidf, ectTFIDFMax, ectTFIDFMin)) + ((1 - gamma) * tws.dbpediaScore));
                scoreTotal += finalScore;
                return {
                    term: tws.term,
                    finalScore
                };
            }
            else if (tws.term instanceof NamedEntityTerm) {
                const finalScore = ((gamma * reduceNumberInRange(tws.tfidf, ectTFIDFMax, ectTFIDFMin)) + ((1 - gamma) * tws.dbpediaScore));
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
        return _returnAsSummary(
            finalTermsToConsider.slice(0, numberOfWords).map((twt) => {
                return twt.term.term;
            }),
            new Map<string, number>(),
            new Map<string, number>(),
            new Map<string, number>(),
            finalTermsToConsider
        );
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

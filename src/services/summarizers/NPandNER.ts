import { EALREADY, SSL_OP_NO_TLSv1 } from "constants";
import CoreNLP from "corenlp";
import _ = require("lodash");
import { CandidateTerm } from "../../models/CandidateTerm";
import { NamedEntityTerm } from "../../models/NamedEntityTerm";
import { Term } from "../../models/Term";
import { logger } from "../../utils/logger";
import { calculateTFIDF, termIDFCorpus, termIDFUser } from "../metrics/tfidf";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { getDBpediaScore, queryDBpedia } from "../processors/dbpedia";
import { extractNamedEntitiesFromCoreNLPDocument } from "../processors/namedEntities";
const stringSimilarity = require("string-similarity");

interface TermWithTFIDF {
    term: Term;
    tfidf: number;
}

interface TermWithScore {
    term: Term;
    score: number;
}

export async function npAndNERSummary(annotated: CoreNLP.simple.Document, numberOfWords: number): Promise<Array<string>> {

    const namedEntityFilter = ["PERSON", "LOCATION", "ORGANIZATION", "MISC", "NATIONALITY", "COUNTRY", "STATE_OR_PROVENCE", "TITLE", "IDEOLOGY", "RELIGION", "CRIMINAL_CHARGE", "CAUSE_OF_DEATH"];
    const namedEntityDBpediaFilter = ["PERSON", "LOCATION", "ORGANIZATION"];

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
            // else if (term instanceof NamedEntityTerm) {
            //     if (namedEntityDBpediaFilter.indexOf(term.type) === -1) {
            //         const score = await getDBpediaScore(term.term);
            //         if (score > 0.5) {
            //             ret.push(term);
            //         }
            //     }
            //     else {
            //         logger.info(`${term.term} and ${term.type} is SAFE`);
            //         ret.push(term);
            //     }
            // }
            else ret.push(term);
        }
        return ret;
    }

    try {
        logger.info(`npAndNERSummary() called with request to return ${numberOfWords} words...`);
        // Extract Candidate Terms
        const candidateTermMap =  extractCandidateTermsFromCoreNLPDocument(annotated);
        const candidateTermKeys = [...candidateTermMap.keys()].map((key) => CandidateTerm.fromString(key));

        // Extract Named Entities
        const namedEntityMap = extractNamedEntitiesFromCoreNLPDocument(annotated);
        const namedEntityKeys = [...namedEntityMap.keys()].map((key) => NamedEntityTerm.fromString(key));

        logger.info(`Candidate Terms and Named Entities Extracted: ${candidateTermKeys.length + namedEntityKeys.length} total terms to consider`);

        // Early termination
        if (_.isEmpty(namedEntityKeys) && _.isEmpty(candidateTermKeys)) {
            logger.info(`No named Entities or Candidate terms. Returning early...`);
            return [annotated.toString()];
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
            return termsToConsider.map((ttc) => ttc.term);
        }

        logger.info(`Beginning to query DBpedia to remove vague Candidate Terms`);
        const specificTerms = await _processDBP(termsToConsider);

        // Early Exit Condition 3;
        if (specificTerms.length < numberOfWords) {
            return specificTerms.map((ttc) => ttc.term);
        }

        logger.info(`Removed ${termsToConsider.length - specificTerms.length} terms`);
        logger.info(`Proceeding with the remaining ${specificTerms.length} terms`);
        return termsToConsider.map((term) => term.term);

        // Remove all CandidateTerms with below average TFIDF
        /*
        let ectTFIDFTotal: number = 0;
        let ectCount: number = 0;
        let neTFIDFTotal: number = 0;
        let neCount: number = 0;

        const finalFinalTerms = await Promise.all(specificTerms.map(async (term: Term): Promise<TermWithTFIDF> => {
            if (term instanceof CandidateTerm) {
                const tf = candidateTermMap.get(Term.toString(term));
                const idf = await termIDFCorpus(term);
                const tfidf = tf * idf;
                ectTFIDFTotal += tfidf;
                ectCount++;
                return {term, tfidf};
            }
            else if (term instanceof NamedEntityTerm) {
                const tf = namedEntityMap.get(Term.toString(term));
                const idf = 1;
                const tfidf = tf * idf;
                neTFIDFTotal += tfidf;
                neCount++;
                return {term, tfidf};
            }
        }));

        const ectTFIDFAverage = ectTFIDFTotal / ectCount;
        const neTFIDFAverage = neTFIDFTotal / neCount;

        const finalFinalFinal = finalFinalTerms.filter((twt: TermWithTFIDF) => {
            if (twt.term instanceof CandidateTerm) {
                return twt.tfidf >= ectTFIDFAverage;
            }
            else {
                return true;
            }
        });

        // Final Terms to Consider
        logger.info(`Candidate Term TFIDF Average: ${ectTFIDFAverage}`);
        logger.info(`Named Entity TFIDF Average: ${neTFIDFAverage}`);
        logger.info(`Reduced to ${finalFinalFinal.length} terms`);
        return finalFinalFinal.map((twt) => twt.term.term);
        */
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

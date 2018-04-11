import { EALREADY, SSL_OP_NO_TLSv1 } from "constants";
import CoreNLP from "corenlp";
import _ = require("lodash");
import { CandidateTerm, ExtractedCandidateTerm, ExtractedCandidateTermMap } from "../../models/CandidateTerm";
import { NamedEntityTerm, Term } from "../../models/NamedEntityTerm";
import { logger } from "../../utils/logger";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { getDBpediaScore } from "../processors/dbpedia";
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
            if (arr[i] instanceof ExtractedCandidateTerm && arr[i].term.length > 1) {
                // logger.info(`checking ct: ${arr[i].term}`);
                const score = await getDBpediaScore(arr[i].term);
                // logger.info(`Score for ${arr[i].term} is: ${score}`);
                if (score > 0.5) {
                    ret.push(arr[i]);
                }
            }
            else if (arr[i] instanceof NamedEntityTerm) {
                ret.push(arr[i]);
            }
        }
        return ret;
    }

    try {
        logger.info(`npAndNERSummary() called with request to return ${numberOfWords} words...`);
        // Extract Candidate Terms
        const candidateTermMap =  extractCandidateTermsFromCoreNLPDocument(annotated);
        const candidateTermKeys = [...candidateTermMap.keys()].map((key) => ExtractedCandidateTerm.fromString(key));

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
                        if ((t1 instanceof NamedEntityTerm) && (t2 instanceof ExtractedCandidateTerm)) {
                            termsToRemove.push(Term.toString(t2));
                        }
                        else if ((t2 instanceof NamedEntityTerm) && (t1 instanceof ExtractedCandidateTerm)) {
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
        // logger.info(`!!!!!${alreadyChecked.length === unifiedTerms.length}$$$$$$$`);
        // logger.info(`${termsToRemove.length  < unifiedTerms.length}`);
        const termsToConsider = unifiedTerms.filter((term) => termsToRemove.indexOf(Term.toString(term)) === -1);
        // termsToRemove.forEach((term) => {
        //     logger.info(term);
        // });
        // termsToConsider.forEach((tcc) => {
        //     logger.info(`${tcc.term} and ${tcc.type}`);
        // });
        logger.info(`removed ${unifiedTerms.length - termsToConsider.length} terms.`);
        logger.info(`Examining the remaining: ${termsToConsider.length} unique terms`);

        // Early Exit Condition 2;
        if (termsToConsider.length < numberOfWords) {
            return termsToConsider.map((ttc) => ttc.term);
        }

        logger.info(`Beginning to query DBpedia to remove vague Candidate Terms`);
        const specificTerms = await _processDBP(termsToConsider);
        logger.info(`Removed ${termsToConsider.length - specificTerms.length} terms`);
        logger.info(`Proceeding with the remaining ${specificTerms.length} terms`);
        specificTerms.forEach((term) => {
            logger.info(`${term.type} - ${term.term}`);
        });

        // logger.info(`done querying. Only ${chomp.length} items remaining`);
        // const tfIdfTotal: number = 0;
        // const ectCount: number = 0;
        // TFIDF -> top half
        // Named entity -> top half

        // const finalFinalTerms = await Promise.all(tyrebf.map(async (term: Term): Promise<TermWithTFIDF> => {
        //     if (term instanceof ExtractedCandidateTerm) {
        //         const idf = await candidateTermIDFCorpus(term);
        //         const tfidf = calculateTFIDF(candidateTerms.get(term)["1"], idf);
        //         // tfIdfTotal += tfidf;
        //         // ectCount += 1;
        //         return {
        //             term,
        //             tfidf,
        //         };
        //     }
        //     else if (term instanceof NamedEntityTerm) {
        //         logger.info(`Named Entity: ${term.term}`);
        //         const tfidf = 1;
        //         return {
        //             term,
        //             tfidf
        //         };
        //     }
        // }));
        // const averageTFIDF = tfIdfTotal / ectCount;
        // const QQQ = finalFinalTerms.filter((term: TermWithTFIDF) => {
        //     if (term.term instanceof ExtractedCandidateTerm) {
        //         logger.info(`WAAAAAAAAAA: ${term.term.term} - ${term.tfidf} - ${averageTFIDF}`);
        //         return term.tfidf > averageTFIDF;
        //     }
        //     else return true;
        // });

        // const finalFinalFinal = finalFinalTerms.sort((t1, t2) => {
        //     if (t1.tfidf > t2.tfidf) {
        //         return -1;
        //     }
        //     else if (t1.tfidf < t2.tfidf) {
        //         return 1;
        //     }
        //     else return 0;
        // });

        // finalFinalFinal.forEach((fff) => {
        //     logger.info(fff.term.term);
        //     logger.info(`${fff.tfidf}`);
        // });

        // logger.info(`${finalFinalFinal.length} terms left to consider`);
        return ["hello"];
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}
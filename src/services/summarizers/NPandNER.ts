import CoreNLP from "corenlp";
import _ = require("lodash");
import { NamedEntityTerm, Term } from "../../models/NamedEntityTerm";
import { logger } from "../../utils/logger";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
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

    const namedEntityFilter = ["PERSON", "LOCATION", "ORGANIZATION", "MISC", "COUNTRY", "NATIONALITY", "COUNTRY", "STATE_OR_PROVENCE", "TITLE", "IDEOLOGY", "RELIGION", "CRIMINAL_CHARGE", "CAUSE_OF_DEATH"];

    function _namedEntityAndCandidateTermComparator(obj1: Term, obj2: Term): boolean {
        if (obj1 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(obj1.type) === -1;
        }
        else if (obj2 instanceof NamedEntityTerm) {
            return namedEntityFilter.indexOf(obj2.type) === -1;
        }
        return obj1.term === obj2.term;
    }

    try {
        logger.info(`npAndNERSummary() called with ${numberOfWords} words...`);
        // Extract Candidate Terms
        const candidateTerms =  extractCandidateTermsFromCoreNLPDocument(annotated);
        const candidateTermKeys = candidateTerms.store().map((ct) => ct["0"]);

        // Extract Named Entities
        const namedEntityMap = extractNamedEntitiesFromCoreNLPDocument(annotated);
        // namedEntityMap.forEach((val, key) => {
        //     logger.info(`${key}: ${val}`);
        // });
        const namedEntities = [...namedEntityMap.keys()].map((key) => NamedEntityTerm.fromString(key));
        logger.info(`${candidateTermKeys.length + namedEntities.length} total terms to consider`);

        // Early termination
        if (_.isEmpty(namedEntities) && _.isEmpty(candidateTerms.toStringArray())) {
            return [annotated.toString()];
        }

        // namedEntities.forEach((ner) => {
        //     logger.info(`NAMED ENTITY: ${ner.term}`);
        // });

        // const arr: Array<Term> = new Array<Term>().concat(candidateTermKeys).concat(namedEntities);
        const bloop: Array<Term> = _.unionWith(namedEntities, candidateTermKeys, _namedEntityAndCandidateTermComparator);
        // const intersection: Array<Term> = _.intersectionWith(candidateTermKeys, namedEntities, _namedEntityAndCandidateTermComparator);
        logger.info(`Unique Terms: ${bloop.length}`);
        // diff.forEach((term) => {
        //     logger.info(`REMOVED: ${term.term}`);
        // });

        // logger.info(`removed ${(namedEntities.length + candidateTerms.size()) - bloop.length} terms`);

        // const termsToRemove = new Array<Term>();
        // for (let i = 0; i < bloop.length; i++) {
        //     const rest = bloop.slice(0, i).concat((bloop.slice(i + 1, bloop.length)));
        //     for (let j = 0; j < rest.length; j++) {
        //         if (stringSimilarity.compareTwoStrings(bloop[i].term, rest[j].term) > 0.75) {
        //             if (termsToRemove.indexOf(bloop[i]) === -1) {
        //                 logger.info(`${bloop[i].term} and ${rest[j].term} too similar`);
        //                 if (bloop[i] instanceof NamedEntityTerm) {
        //                     logger.info(`removing ${rest[j]}`);
        //                     termsToRemove.push(rest[j]);
        //                 }
        //                 else bloop[i].term.length > rest[j].term.length ? termsToRemove.push(bloop[i]) : termsToRemove.push(rest[j]);
        //             }
        //         }
        //     }
        // }
        // await getDBpediaScore("hello!");
        // const termsToConsider = bloop.filter((bleep) => termsToRemove.indexOf(bleep) === -1);
        // logger.info(`Named entities afterwards...`);
        // termsToConsider.forEach((ttc) => {
        //     if (ttc instanceof NamedEntityTerm) {
        //         logger.info(`Named Entity: ${ttc.term}`);
        //     }
        // });
        // logger.info(`removed ${bloop.length - termsToConsider.length} terms.`);

        // if (termsToConsider.length < numberOfWords) {
        //     return termsToConsider.map((ttc) => ttc.term);
        // }
        // logger.info(`beginning to query dbpedia`);
        // async function processDBP(arr: Array<Term>): Promise<Array<Term>> {
        //     const ret = new Array<Term>();
        //     for (let i = 0; i < arr.length; i++) {
        //         logger.info(`waiting on iter ${i}`);
        //         const score = await getDBpediaScore(arr[i].term);
        //         if (score > 0.5) {
        //             ret.push(arr[i]);
        //         }
        //         logger.info(`done with iter ${i}`);
        //     }
        //     return ret;
        // }

        // logger.info(`${termsToConsider.length}`);
        // const tyrebf = await processDBP(termsToConsider);

        // const chomp: Array<Term>  = await asyncFilter(termsToConsider, (async (term: Term): Promise<boolean> => {
        //     if (term instanceof ExtractedCandidateTerm) {
        //         const score = await getDBpediaScore(term.term);
        //         logger.info(`term: ${term.term}, score: ${score}`);
        //         return score > 0.5;
        //     }
        //     else if (term instanceof NamedEntityTerm) {
        //         logger.info(`NamedEntity!: ${term.term}`);
        //         const score = await getDBpediaScore(term.term);
        //         logger.info(`term: ${term.term}, score: ${score}`);
        //         return score > 0.5;
        //     }
        // }));
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

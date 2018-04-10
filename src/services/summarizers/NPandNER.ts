import CoreNLP from "corenlp";
import _ = require("lodash");
import { ExtractedCandidateTerm } from "../../models/CandidateTerm";
import { DBpediaScore } from "../../models/DBpediaScore";
import { NamedEntityTerm, Term } from "../../models/NamedEntityTerm";
import { asyncFilter, sleep } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { getDBpediaScore, queryDBpedia } from "../processors/dbpedia";
import { extractNamedEntitiesFromCoreNLPDocument } from "../processors/namedEntities";
const stringSimilarity = require("string-similarity");
import * as bluebird from "bluebird";
import { getCountInCoreNLPDocument } from "../corenlp/corenlp";
import { calculateTFIDF, candidateTermIDFCorpus, lemmaIDFCorpus } from "../metrics/tfidf";

interface TermWithTFIDF {
    term: Term;
    tfidf: number;
}

export async function npAndNERSummary(annotated: CoreNLP.simple.Document, numberOfWords: number): Promise<Array<string>> {

    function _namedEntityAndCandidateTermComparator(obj1: Term, obj2: Term): boolean {
        return obj1.term === obj2.term;
    }

    try {
        // Extract Candidate Terms
        const candidateTerms =  extractCandidateTermsFromCoreNLPDocument(annotated);
        const candidateTermKeys = candidateTerms.store().map((ct) => ct["0"]);

        // Extract Named Entities
        const namedEntities = extractNamedEntitiesFromCoreNLPDocument(annotated);
        namedEntities.forEach((ne) => {
            logger.info(`Named Entity: ${ne.term}`);
        });

        // Early termination
        if (_.isEmpty(namedEntities) && _.isEmpty(candidateTerms.toStringArray())) {
            return [annotated.toString()];
        }
        const importantNamedEntities = ["PERSON", "LOCATION", "ORGANIZATION", "MISC", "COUNTRY", "NATIONALITY", "COUNTRY", "STATE_OR_PROVENCE", "TITLE", "IDEOLOGY", "RELIGION", "CRIMINAL_CHARGE", "CAUSE_OF_DEATH"];
        const blep: Array<Term> = _.unionWith(candidateTermKeys, namedEntities, _namedEntityAndCandidateTermComparator);

        const bloop = blep.filter((b) => {
            if (b.term.length < 2) return false;
            if (b instanceof NamedEntityTerm) {
                logger.info(`Checking ${b.term}`);
                logger.info(`Type: ${b.type}`);
                const q = importantNamedEntities.indexOf(b.type) !== -1;
                logger.info(`${q}`);
                return q;
            }
            else if (b instanceof ExtractedCandidateTerm) {
                return true;
            }
        });
        logger.info(`remove ${blep.length - bloop.length} terms`);

        const termsToRemove = new Array<Term>();
        for (let i = 0; i < bloop.length; i++) {
            const rest = bloop.slice(0, i).concat((bloop.slice( i + 1, bloop.length)));
            for (let j = 0; j < rest.length; j++) {
                if (stringSimilarity.compareTwoStrings(bloop[i].term, rest[j].term) > 0.75) {
                    bloop[i].term.length > rest[j].term.length ? termsToRemove.push(bloop[i]) : termsToRemove.push(rest[j]);
                }
            }
        }
        const termsToConsider = bloop.filter((bleep) => termsToRemove.indexOf(bleep) === -1);
        logger.info(`removed ${bloop.length - termsToConsider.length} terms out of a possible ${bloop.length}`);

        if (termsToConsider.length < numberOfWords) {
            return termsToConsider.map((ttc) => ttc.term);
        }
        logger.info(`beginning to query dbpedia`);
        const chomp: Array<Term>  = await asyncFilter(termsToConsider, (async (term: Term): Promise<boolean> => {
            logger.info(`async filter call`);
            if (term instanceof ExtractedCandidateTerm) {
                const score = await getDBpediaScore(term.term);
                logger.info(`term: ${term.term}, score: ${score}`);
                return score > 0.5;
            }
            else {
                logger.info(`NamedEntity!: ${term.term}`);
                return Promise.resolve(true);
            }
        }));
        logger.info(`done querying. Only ${chomp.length} items remaining`);
        let tfIdfTotal: number = 0;
        let ectCount: number = 0;
        const finalFinalTerms = await Promise.all(chomp.map(async (term: Term): Promise<TermWithTFIDF> => {
            if (term instanceof ExtractedCandidateTerm) {
                const idf = await candidateTermIDFCorpus(term);
                const tfidf = calculateTFIDF(candidateTerms.get(term)["1"], idf);
                tfIdfTotal += tfidf;
                ectCount += 1;
                return {
                    term,
                    tfidf,
                };
            }
            else if (term instanceof NamedEntityTerm) {
                logger.info(`Named Entity: ${term.term}`);
                const tfidf = 1;
                return {
                    term,
                    tfidf
                };
            }
        }));
        const averageTFIDF = tfIdfTotal / ectCount;
        const QQQ = finalFinalTerms.filter((term: TermWithTFIDF) => {
            if (term.term instanceof ExtractedCandidateTerm) {
                return term.tfidf > averageTFIDF;
            }
            else return true;
        });

        const finalFinalFinal = QQQ.sort((t1, t2) => {
            if (t1.tfidf > t2.tfidf) {
                return -1;
            }
            else if (t1.tfidf < t2.tfidf) {
                return 1;
            }
            else return 0;
        });

        finalFinalFinal.forEach(((fff) => {
            logger.info(fff.term.term);
            logger.info(fff.tfidf.toPrecision(4));
        }));

        return ["hello"];
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

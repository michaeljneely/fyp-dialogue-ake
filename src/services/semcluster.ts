import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as _ from "lodash";
import { stopwords } from "../constants/filters";
import { logger } from "../utils/logger";
import { Stack } from "../utils/stack";

/**
 * Extract all Candidate Terms from a CoreNLP document
 * Based on "SemCluster: Unsupervised Automatic Keyphrase Extraction Using Affinity Propagation" - https://doi.org/10.1007/978-3-319-66939-7_19
 * Candidate Terms fall into 3 categories:
 *  -> Noun = (NN|NNS) - a singleton noun
 *  -> Compound Noun = (JJ)? * (NN|NNS)+ - sequence of words starting with an adjective or noun
 *  -> Entity = (NNP|NNPS) * (S)? * (NNP|NNPS)+ - sequence of words of proper nouns with at most one stopword in the middle.
 * @param {CoreNLP.simple.Document} document CoreNLP document
 * @returns {Array<string>} Array of candidate terms
 */
export function extractCandidateTerms(document: CoreNLP.simple.Document): Array<string> {
    // POS tags for Noun (singular and plural)
    const noun = ["NN", "NNS"];
    // POS tags for Noun Phrase (singular and plural)
    const nounPhrase = ["NNP", "NNPS"];

    const candidateTerms = new Array<string>();

    // Stack to construct candidate terms
    const termStack = new Stack<CoreNLP.simple.Token>();

    for (const sentence of document.sentences()) {
        sentence.tokens().forEach((token, index) => {
            logger.info(token.word());
            // Early exit condition
            let done = false;

            // Peek at the top of the stack.
            const top = termStack.peek();
            logger.info(`Top - ${top}`);

            // If there are currently items in the stack
            if (top) {
                // If top is stopword - Attempt to continue building Entity
                if ((stopwords.indexOf(top.word().toLowerCase()) !== -1) || (stopwords.indexOf(top.lemma().toLowerCase()) !== -1)) {
                    // Continue building Entity - Add token if it is a noun phrase
                    logger.info("Attempting to continue building entity");
                    if (nounPhrase.indexOf(token.pos()) !== -1) {
                        logger.info(`Adding noun phrase ${token.lemma()}...`);
                        termStack.push(token);
                        // If next toke is not a noun phrase, terminate construction Noun Phrase
                        if ((index + 1 >= sentence.tokens().length) || nounPhrase.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Entity");
                            done = true;
                        }
                    }
                    // Otherwise attempt to return existing entity already in the stack
                    else {
                        logger.info("Not a noun phrase - extract existing noun phrase from stack");
                        const nounPhrases = termStack.data().filter((token) => {
                            return nounPhrase.indexOf(token.pos()) !== -1;
                        });
                        termStack.clear();
                        for (const nounPhrase of nounPhrases) {
                            logger.info(`${nounPhrase.lemma()} extracted`);
                            termStack.push(nounPhrase);
                        }
                        done = true;
                    }
                }
                // If top is adjective - Attempt to build Compound Noun
                else if (top.pos() === "JJ") {
                    // Continue building Compound Noun - Add token if it is a noun
                    logger.info("Attempting to continue building compound noun");
                    if (noun.indexOf(token.pos()) !== -1) {
                        logger.info(`Adding noun ${token.lemma()}...`);
                        termStack.push(token);
                        // If next token is not a noun, terminate construction of Compound Noun
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Compound Noun");
                            done = true;
                        }
                    }
                    // Otherwise this is not a candidate phrase - clear the stack
                    else {
                        logger.info("Not a noun - abandon attempt to build compound noun - Clearing stack!");
                        termStack.clear();
                    }
                }
                // If top is Noun - Attempt to continue building Compound Noun
                else if (noun.indexOf(top.pos()) !== -1) {
                    // Continue building Compound Noun - Add token if it is noun
                    logger.info("Attempting to continue building compound noun");
                    if (noun.indexOf(token.pos()) !== -1) {
                        logger.info(`Adding noun ${token.lemma()}...`);
                        termStack.push(token);
                        // If next token is not a noun, terminate construction of Compound Noun
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Compound Noun");
                            done = true;
                        }
                    }
                    // Otherwise attempt to return nouns already in stack
                    else {
                        const nouns = termStack.data().filter((token) => {
                            return noun.indexOf(token.pos()) !== -1;
                        });
                        termStack.clear();
                        for (const noun of nouns) {
                            logger.info(`${noun.lemma()} extracted`);
                            termStack.push(noun);
                        }
                        done = true;
                    }
                }
                // Else top is noun phrase - Attempt to continue building Entity
                else {
                    // If token is stopword, add if stack only contains 1 noun phrase
                    if (((stopwords.indexOf(token.lemma()) !== -1) && (termStack.data().length === 1))) {
                        logger.info(`Adding stopword ${token.lemma()}...`);
                        termStack.push(token);
                    }
                    // If token is noun phrase, add
                    else if (nounPhrase.indexOf(token.pos()) !== -1) {
                        logger.info(`Adding noun phrase ${token.lemma()}...`);
                        termStack.push(token);
                        // If next token is not a noun phrase, terminate construction of Entity
                        if ((index + 1 >= sentence.tokens().length) || nounPhrase.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            logger.info("Terminating as Entity");
                            done = true;
                        }
                    }
                    // Otherwise attempt to return existing entity already in the stack
                    else {
                        logger.info("Not a noun phrase or stopword!");
                        const nounPhrases = termStack.data().filter((token) => {
                            return nounPhrase.indexOf(token.pos()) !== -1;
                        });
                        termStack.clear();
                        for (const nounPhrase of nounPhrases) {
                            logger.info(`${nounPhrase.lemma()} extracted`);
                            termStack.push(nounPhrase);
                        }
                        done = true;
                    }
                }
            }
            // Otherwise the stack is empty - Begin attempt at building candidate phrase
            else {
                // Candidate phrase cannot begin with a stopword
                if (stopwords.indexOf(token.lemma()) === -1 || stopwords.indexOf(token.word()) === -1) {
                    // If token is a noun, adjective, or noun phrase - begin construction of candidate phrase
                    if (noun.indexOf(token.pos()) !== -1 || nounPhrase.indexOf(token.pos()) !== -1 || token.pos() === "JJ") {
                        logger.info(`Building new Candidate phrase. Adding ${token.pos()} - ${token.lemma()}`);
                        termStack.push(token);
                    }
                }
            }
            // Early termination signaled or at the end of a sentence
            if (done || index === (sentence.tokens().length - 1) ) {
                // Build string from stack (if populated)
                if (termStack.data().length > 0) {
                    const candidateTerm = buildStringFromTokenStack(termStack);
                    logger.info(`Done! Adding Term Candidate ${candidateTerm}`);
                    // Add to candidate terms
                    candidateTerms.push(candidateTerm);
                    // Clear the stack to accommodate the next candidate phrase
                    termStack.clear();
                }
            }
        });
        // Clear the stack after processing a sentence
        termStack.clear();
    }
    // Return unique candidate terms only
    logger.info("Returning unique candidate terms...");
    return _.uniq(candidateTerms);
}

/**
 * Build a string from a CoreNLP token stack
 * @param stack {Stack<CoreNLP.simple.Token>} Stack of CoreNLP tokens
 * @returns {string} constructed string
 */
export function buildStringFromTokenStack(stack: Stack<CoreNLP.simple.Token>): string {
    let res = "";
    stack.data().forEach((token) => {
        res += `${token.word()} `;
    });
    return res.trim();
}

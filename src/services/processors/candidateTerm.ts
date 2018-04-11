import CoreNLP from "corenlp";
import { stopwords } from "../../constants/filters";
import { CandidateTermTypes, ExtractedCandidateTerm, ExtractedCandidateTermMap } from "../../models/CandidateTerm";
import { Term } from "../../models/NamedEntityTerm";
import { logger } from "../../utils/logger";
import { Stack } from "../../utils/stack";

/**
 * Find and count all unique "Candidate Terms" (NP Chunks) in a CoreNLP document
 * Based on "SemCluster: Unsupervised Automatic Keyphrase Extraction Using Affinity Propagation" - https://doi.org/10.1007/978-3-319-66939-7_19
 * Candidate Terms fall into 3 categories:
 *  -> Noun (N) = (NN|NNS) - a singleton noun
 *  -> Compound Noun (C) = (JJ)? * (NN|NNS)+ - sequence of words starting with an adjective or noun
 *  -> Entity (E) = (NNP|NNPS) * (S)? * (NNP|NNPS)+ - sequence of words of proper nouns with at most one stopword in the middle.
 * @param {CoreNLP.simple.Document} document CoreNLP document
 * @returns {ExtractedCandidateTermMap>} (ExtractedCandidateTerm -> Frequency) Map
 */
export function extractCandidateTermsFromCoreNLPDocument(document: CoreNLP.simple.Document): Map<string, number> {
    return mapCandidateTerms(findCandidateTerms(document));
}

/**
 * Find all Candidate Terms in a CoreNLP document
 * @param document CoreNLP documents
 * @returns {Array<ExtractedCandidateTerm>} All candidate terms found in the document
 */
function findCandidateTerms(document: CoreNLP.simple.Document): Array<ExtractedCandidateTerm> {

    logger.info(`findCandidateTerms() - finding Candidate Terms..`);

    // POS tags for Noun (singular and plural)
    const noun = ["NN", "NNS"];
    // POS tags for Noun Phrase (singular and plural)
    const nounPhrase = ["NNP", "NNPS"];

    const candidateTerms = new Array<ExtractedCandidateTerm>();

    // Stack to construct candidate terms
    const termStack = new Stack<CoreNLP.simple.Token>();

    let tokenCount: number = 0;

    for (const sentence of document.sentences()) {
        sentence.tokens().forEach((token, index) => {
            tokenCount++;
            // Early exit condition
            let done = false;
            // Type of Extracted Term (N,C,E)
            let termType: CandidateTermTypes;
            // Peek at the top of the stack.
            const top = termStack.peek();
            // If there are currently items in the stack
            if (top) {
                // If top is stopword - Attempt to continue building Entity
                if ((stopwords.indexOf(top.word().toLowerCase()) !== -1) || (stopwords.indexOf(top.lemma().toLowerCase()) !== -1)) {
                    // Continue building Entity - Add token if it is a noun phrase
                    if (nounPhrase.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        // If next toke is not a noun phrase, terminate construction as Entity
                        if ((index + 1 >= sentence.tokens().length) || nounPhrase.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            termType = "ENTITY";
                            done = true;
                        }
                    }
                    // Otherwise attempt to return existing Entity already in the stack
                    else {
                        const nounPhrases = termStack.data().filter((token) => {
                            return nounPhrase.indexOf(token.pos()) !== -1;
                        });
                        termStack.clear();
                        for (const nounPhrase of nounPhrases) {
                            termStack.push(nounPhrase);
                        }
                        termType = "ENTITY";
                        done = true;
                    }
                }
                // If top is adjective - Attempt to build Compound Noun
                else if (top.pos() === "JJ") {
                    // Continue building Compound Noun - Add token if it is a noun
                    if (noun.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        // If next token is not a noun, terminate construction of Compound Noun
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            termType = "COMPOUND NOUN";
                            done = true;
                        }
                    }
                    // Otherwise this is not a candidate phrase - clear the stack
                    else {
                        termStack.clear();
                    }
                }
                // If top is Noun - Attempt to continue building Compound Noun
                else if (noun.indexOf(top.pos()) !== -1) {
                    // Continue building Compound Noun - Add token if it is noun
                    if (noun.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        // If next token is not a noun, terminate construction of Compound Noun
                        if ((index + 1 >= sentence.tokens().length) || noun.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            termType = "COMPOUND NOUN";
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
                            termStack.push(noun);
                        }
                        termType = (nouns.length === 1) ? "NOUN" : "COMPOUND NOUN";
                        done = true;
                    }
                }
                // Else top is noun phrase - Attempt to continue building Entity
                else {
                    // If token is stopword, add if stack only contains 1 noun phrase
                    if (((stopwords.indexOf(token.lemma()) !== -1) && (termStack.data().length === 1))) {
                        termStack.push(token);
                    }
                    // If token is noun phrase, add
                    else if (nounPhrase.indexOf(token.pos()) !== -1) {
                        termStack.push(token);
                        // If next token is not a noun phrase, terminate construction of Entity
                        if ((index + 1 >= sentence.tokens().length) || nounPhrase.indexOf(sentence.tokens()[index + 1].pos()) === -1) {
                            termType = "ENTITY";
                            done = true;
                        }
                    }
                    // Otherwise attempt to return existing entity already in the stack
                    else {
                        const nounPhrases = termStack.data().filter((token) => {
                            return nounPhrase.indexOf(token.pos()) !== -1;
                        });
                        termStack.clear();
                        for (const nounPhrase of nounPhrases) {
                            termStack.push(nounPhrase);
                        }
                        termType = "ENTITY";
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
                        termStack.push(token);
                    }
                }
            }
            // Early termination signaled or at the end of a sentence
            if (done || index === (sentence.tokens().length - 1) ) {
                // Build string from stack (if populated)
                if (termStack.data().length > 0) {
                    const candidateTerm = buildStringFromTokenStack(termStack);
                    // Add to candidate terms
                    candidateTerms.push(new ExtractedCandidateTerm(candidateTerm, termType));
                    // Clear the stack to accommodate the next candidate phrase
                    termStack.clear();
                }
            }
        });
        // Clear the stack after processing a sentence
        termStack.clear();
    }
    logger.info(`Extracted ${candidateTerms.length} non-unique Candidate Terms out of ${tokenCount} tokens`);
    // Return unique candidate terms only
    return candidateTerms;
}

/**
 * Build a string from a CoreNLP token stack
 * @param stack {Stack<CoreNLP.simple.Token>} Stack of CoreNLP tokens
 * @returns {string} constructed string
 */
export function buildStringFromTokenStack(stack: Stack<CoreNLP.simple.Token>): string {
    let res = "";
    stack.data().forEach((token) => {
        res += `${token.word().toLowerCase()} `;
    });
    return res.trim();
}

/**
 * Transform array of non-unique ExtractedCandidateTerms into a (ExtractedCandidateTerm, Frequency) map
 * @param {Array<ExtractedCandidateTerms>} candidateTerms
 * @returns {Map<ExtractedCandidateTerm, number>} ExtractedCandidateTerm -> Frequency Map
 */
function mapCandidateTerms(candidateTerms: Array<ExtractedCandidateTerm>): Map<string, number> {
    const map = new Map<string, number>();
    candidateTerms.forEach((candidateTerm) => {
        const existing = map.get(ExtractedCandidateTerm.toString(candidateTerm));
        if (existing) {
            map.set(ExtractedCandidateTerm.toString(candidateTerm), existing + 1);
        }
        else {
            map.set(ExtractedCandidateTerm.toString(candidateTerm), 1);
        }
    });
    return map;
}

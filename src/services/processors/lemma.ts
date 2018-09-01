import CoreNLP from "corenlp";
import { AlphaNumericRegex, stopwords } from "../../constants/filters";
import { logger } from "../../utils/logger";

/**
 * Extract all meaningful (non-stopword, alphanumeric) terms from a CoreNLP document
 * Terms are returned as lemmas (canonical forms)
 * @param {CoreNLP.simple.Document} document CoreNLP Document
 * @returns {Map<string, number>} Unique lemmas and their frequencies
 */
export function extractMeaningfulLemmasFromCoreNLPDocument(document: CoreNLP.simple.Document): Map<string, number> {
    logger.info(`extractMeaningfulLemmasFromCoreNLPDocument() - finding lemmas...`);
    const lemmas = new Map<string, number>();
    for (const sentence of document.sentences()) {
        sentence.tokens().forEach((token, index) => {
            const lemma = token.lemma().toLowerCase();
            const stopword = ((stopwords.indexOf(lemma.toLowerCase()) !== -1) || (stopwords.indexOf(token.word().toLowerCase()) !== -1));
            if ((AlphaNumericRegex.test(token.lemma())) && !stopword) {
                if (lemmas.has(lemma)) {
                    lemmas.set(lemma, lemmas.get(lemma) + 1);
                } else {
                    lemmas.set(lemma, 1);
                }
            }
        });
    }
    logger.info(`Returning ${lemmas.size} unique lemmas`);
    return lemmas;
}

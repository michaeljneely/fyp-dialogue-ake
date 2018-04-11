import CoreNLP, { ConnectorServer, Pipeline } from "corenlp";
import { connector } from "../../app";
import { annotators } from "../../constants/annotators";
import { logger } from "../../utils/logger";

/* Handles everything to do with CoreNLP documents */

/**
 * Annotate text with the CoreNLP Server. No preprocessing is performed.
 * @param {string} text Text to annotate
 * @param {boolean} useCorpusAnnotators? If true, do not perform dependency parsing
 * @param {ConnectorServer} newConnector? If supplied, create a new connection to the CoreNLP server
 * @returns {CoreNLP.simple.Document}
 */
export async function annotate(text: string): Promise<CoreNLP.simple.Document> {
    try {
        logger.info(`CoreNLP annotate() text of length ${text.length}`);
        const pipeline = new Pipeline(annotators, process.env.LANGUAGE, connector);
        const document = new CoreNLP.simple.Document(text);
        const result: CoreNLP.simple.Document = await pipeline.annotate(document) as CoreNLP.simple.Document;
        return Promise.resolve(result);
    }
    catch (error) {
        logger.error(error);
        return Promise.reject("Oops! There was an issue connecting to CoreNLP server");
    }
}

/**
 * Get the count of a specific term in a CoreNLP Document
 * @param {string} term Term to Count Occurrences of
 * @param {CoreNLP.simple.Document} annotated CoreNLP document
 */
export function getCountInCoreNLPDocument(term: string, annotated: CoreNLP.simple.Document): number {
    let count: number = 0;
    annotated.sentences().forEach((sentence) => {
        sentence.tokens().forEach((token) => {
            if (token.lemma().toLowerCase() === term || token.word().toLowerCase() === term) {
                count++;
            }
        });
    });
    return count;
}

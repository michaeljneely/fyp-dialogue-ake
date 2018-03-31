import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { connector } from "../app";
import { annotators, corpusAnnotators } from "../constants/annotators";
import { Conversation } from "../models/Conversation";
import { replaceSmartQuotes, replaceStopWords, stripSpeakers } from "../utils/functions";
import { logger } from "../utils/logger";

/**
 * Parse text with CoreNLP server. Preprocessing removes speakers and replaces smart quotes
 * @param {string} text Text to parse
 * @param {boolean} corpus Use corpus annotators?
 * @returns {Promise<Conversation>} Parsed conversation
 */
export async function parseDocument(text: string, corpus: boolean = false): Promise<Conversation> {
    try {
        const [speakers, doc] = stripSpeakers(text);
        const document = replaceSmartQuotes(doc);
        const properties = (corpus) ? corpusAnnotators : annotators;
        const pipeline = new Pipeline(properties, process.env.LANGUAGE, connector);
        const sent = new CoreNLP.simple.Document(document);
        const result: CoreNLP.simple.Document = await pipeline.annotate(sent) as CoreNLP.simple.Document;
        return Promise.resolve({
            speakers,
            document: result
        });
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

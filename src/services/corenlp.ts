import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { connector } from "../app";
import { annotators, corpusAnnotators } from "../constants/annotators";
import { Conversation } from "../models/Conversation";
import { replaceSmartQuotes, replaceStopWords, stripSpeakers } from "../utils/functions";
import { logger } from "../utils/logger";

/**
 * Parse text with CoreNLP server. Preprocessing removes speakers and replaces smart quotes
 * @param {string} text Text to parse
 * @param {boolean} useCorpusAnnotators Use corpus annotators?
 * @returns {Promise<Conversation>} Parsed conversation
 */
export async function parseDocument(text: string, useCorpusAnnotators: boolean = false, newConnector?: ConnectorServer): Promise<Conversation> {
    try {
        const [speakers, doc] = stripSpeakers(text);
        const document = replaceSmartQuotes(doc);
        const properties = (useCorpusAnnotators) ? corpusAnnotators : annotators;
        const pipeline = (newConnector) ? new Pipeline(properties, process.env.LANGUAGE, newConnector) : new Pipeline(properties, process.env.LANGUAGE, connector);
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

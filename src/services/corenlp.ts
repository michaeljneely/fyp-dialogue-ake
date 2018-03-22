import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";
import { corpusAnnotators, annotators } from "../constants/annotators";
import { stripSpeakers, replaceSmartQuotes, replaceStopWords } from "../utils/functions";

export async function parseDocument(text: string, corpus: boolean = false): Promise<CoreNLP.simple.Document> {
    try {
        const [speakers, doc] = stripSpeakers(text);
        const document = replaceStopWords(replaceSmartQuotes(doc));
        const properties = (corpus) ? corpusAnnotators : annotators;
        const pipeline = new Pipeline(properties, process.env.LANGUAGE, connector);
        const sent = new CoreNLP.simple.Document(document);
        const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
        return Promise.resolve(result);
    } catch (error) {
        logger.error(error);
        return (error.message) ? Promise.reject(error.message) : Promise.reject(error);
    }
}

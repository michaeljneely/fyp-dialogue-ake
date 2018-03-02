import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";

export async function parseDocument(text: string, options: Array<CoreNLP.simple.AnnotatorOption>): Promise<CoreNLP.simple.Document> {
    if (! options.length) return Promise.reject("need options");
    const props = new Properties({
        annotators: options.toString()
    });
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Document(text);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    return result;
}
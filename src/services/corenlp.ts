import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";
import { stopWords } from "../utils/stopwords";
export async function parseDocument(text: string, options: Array<CoreNLP.simple.AnnotatorOption>): Promise<CoreNLP.simple.Document> {
    if (! options.length) return Promise.reject("need options");
    const props = new Properties({
        annotators: options.toString()
    });
    console.log(text);
    const document = text.split(" ").filter((lemma: string) => stopWords.indexOf(lemma.toLowerCase()) === -1).join(" ");
    console.log(document);
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    return result;
}
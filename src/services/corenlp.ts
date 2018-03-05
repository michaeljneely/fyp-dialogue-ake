import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";
import { stopWords } from "../utils/stopwords";
import { annotators } from "../constants/annotators";
export async function parseDocument(text: string): Promise<CoreNLP.simple.Document> {
    const document = text.split(" ").filter((lemma: string) => stopWords.indexOf(lemma.toLowerCase()) === -1).join(" ");
    const pipeline = new Pipeline(annotators, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    return result;
}
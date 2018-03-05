import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";
import { stopWords } from "../utils/stopwords";
import { corpusAnnotators, annotators } from "../constants/annotators";
export async function parseDocument(text: string, corpus: boolean = false): Promise<CoreNLP.simple.Document> {
    const document = text.split(" ").filter((lemma: string) => stopWords.indexOf(lemma.toLowerCase()) === -1).join(" ");
    const properties = (corpus) ? corpusAnnotators : annotators;
    const pipeline = new Pipeline(properties, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    return result;
}
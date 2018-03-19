import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { connector } from "../app";
import { stopwords } from "../constants/stopwords";
import { corpusAnnotators, annotators } from "../constants/annotators";

export async function parseDocument(text: string, corpus: boolean = false): Promise<CoreNLP.simple.Document> {
    const replaceSmartQuotesAndCommas = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\,]/g, "");
    const document = replaceSmartQuotesAndCommas.split(" ").filter((lemma: string) => {
        return stopwords.indexOf(lemma.trim().toLowerCase()) === -1;
    }).join(" ");
    const properties = (corpus) ? corpusAnnotators : annotators;
    const pipeline = new Pipeline(properties, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    return result;
}
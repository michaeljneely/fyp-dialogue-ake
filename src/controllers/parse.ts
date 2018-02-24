import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { tfidf } from "../services/tfidf";

const props = new Properties({
  annotators: "tokenize,ssplit,pos,lemma,ner,parse,relation",
});

export let index = (req: Request, res: Response) => {
  res.render("parse", {
    title: "Parse"
  });
};
export async function parse(connector: ConnectorServer, sentence: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Sentence(sentence);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Sentence;
    logger.info(`parsing: '${sentence}'`);
    return JSON.parse(CoreNLP.util.Tree.fromSentence(result, false).dump());
}

export async function parseDoc(connector: ConnectorServer, document: string): Promise<JSON> {
  return tfidf(connector, document);
}

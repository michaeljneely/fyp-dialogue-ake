import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response } from "express";
import { logger } from "../utils/logger";

const props = new Properties({
  annotators: "tokenize,ssplit,pos,lemma,ner,parse,relation",
});
const connector = new ConnectorServer({ dsn: "http://0.0.0.0:9000" });

export let index = (req: Request, res: Response) => {
  res.render("parse", {
    title: "Parse"
  });
};
export async function parse(sentence: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Sentence(sentence);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Sentence;
    logger.info(`parsing: '${sentence}'`);
    return JSON.parse(CoreNLP.util.Tree.fromSentence(result, false).dump());
}


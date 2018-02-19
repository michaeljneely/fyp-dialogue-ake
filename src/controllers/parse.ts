import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response, NextFunction } from "express";
const request = require("express-validator");
const props = new Properties({
  annotators: "tokenize,ssplit,pos,lemma,ner,parse,relation",
});
const connector = new ConnectorServer({ dsn: "http://0.0.0.0:9000" });

const sent = new CoreNLP.simple.Sentence("Michael is from Seattle and is 23 years old.");

export async function parse(): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Sentence;
    return JSON.parse(CoreNLP.util.Tree.fromSentence(result, false).dump());
}


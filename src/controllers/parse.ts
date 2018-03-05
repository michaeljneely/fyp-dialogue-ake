import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { tfidfSummary } from "../services/tfidf";
import { annotators } from "../constants/annotators";

export let index = (req: Request, res: Response) => {
  res.render("parse", {
    title: "Parse"
  });
};
export async function freeParse(connector: ConnectorServer, text: string): Promise<JSON> {
    try {
      const pipeline = new Pipeline(annotators, "English", connector);
      const sent = new CoreNLP.simple.Document(text);
      const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
      logger.info(`parsing: '${text}'`);
      return result.toJSON();
    } catch (error) {
      return Promise.reject(error);
    }
}

export async function parseDoc(connector: ConnectorServer, document: string): Promise<JSON> {
  return tfidfSummary(connector, document);
}

export let freeIndex = (req: Request, res: Response) => {
  res.render("freeparse", {
    title: "Free Parse"
  });
};

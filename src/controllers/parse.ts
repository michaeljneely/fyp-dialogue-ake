import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { tfidfSummary } from "../services/tfidf";
import { annotators } from "../constants/annotators";
// import { speakerSummary } from "./summarize";

export let index = (req: Request, res: Response) => {
  res.render("parse", {
    title: "Parse"
  });
};
// export async function freeParse(connector: ConnectorServer, text: string): Promise<JSON> {
//     try {
//       return speakerSummary(text);
//     } catch (error) {
//       return Promise.reject(error);
//     }
// }

export async function parseDoc(connector: ConnectorServer, document: string): Promise<JSON> {
  return tfidfSummary(connector, document);
}

export let freeIndex = (req: Request, res: Response) => {
  res.render("freeparse", {
    title: "Free Parse"
  });
};

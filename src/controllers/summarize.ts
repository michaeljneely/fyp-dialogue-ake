import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Request, Response } from "express";
import { annotators } from "../constants/annotators";
import { connector } from "../app";
import { logger } from "../utils/logger";
import { summaryRandom } from "../services/summary";

const pipeline = new Pipeline(annotators, "English", connector);

export let index = (req: Request, res: Response) => {
    res.render("summary", {
      title: "Summary"
    });
  };
export async function speakerSummary(document: string): Promise<JSON> {
    try {
        //  Strip Speakers
        const a = new RegExp(/^((\w+)(?:[\s]?)){2}(?::)/, "gim");
        const speakers: Array<string> = [];
        const text =  document.replace(a, ((speaker: string) => {
            speakers.push(speaker);
            return "";
        }));
        /*
        const speakers: Array<string> = document.match(a).map((speaker: string) => {
            return speaker = speaker.replace(":", "").trim();
        }); */
        console.log(text);
        const sent = new CoreNLP.simple.Document(text);
        const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
        const bloop = result.toJSON();
        Object.assign(bloop, {
            speakers
        });
        return bloop;
      } catch (error) {
        return Promise.reject(error);
      }
}

export async function randomSummary(document: string, wordlength: number): Promise<Array<string>> {
    try {
        const sent = new CoreNLP.simple.Document(document);
        const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
        const summary = summaryRandom(result, wordlength);
        logger.info(summary.toString());
        return summary;
      } catch (error) {
        return Promise.reject(error);
      }
}
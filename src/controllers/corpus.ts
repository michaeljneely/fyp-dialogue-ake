import { Request, Response, NextFunction } from "express";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl, connector } from "../app";
import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, DocumentFrequency } from "../models/CorpusLemma";
import { parseDocument } from "../services/corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as async from "async";
import * as mongoose from "mongoose";

function cb(err: Error, results: any) {
  return results;
}
export let displayCorpus = (req: Request, res: Response) => {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
      CorpusDocument.find((err, documents: Array<CorpusDocumentModel>) => {
        res.render("corpus", {
            title: "Corpus",
            corpus: documents
          });
      });
    } else {
      res.status(403).send("Access Denied");
    }
};

async function addLemma(lemma: string, documentID: mongoose.Schema.Types.ObjectId, frequency: number): Promise<boolean> {
  const corpusLemma = await CorpusLemma.findOne({lemma}).exec() as CorpusLemma;
  let result;
  if (corpusLemma) {
    const df: DocumentFrequency = {
      documentID,
      frequency
    };
    corpusLemma.frequencies.push(df);
    result = await corpusLemma.save();
  }
  else {
    const newCorpusLemma = new CorpusLemma({
      lemma,
      frequencies: [({
        documentID,
        frequency
      })]
    });
    result = await newCorpusLemma.save();
  }
  console.log("promise:" + result);
  return (result) ? true : false;
}

export async function addDocumentToCorpus(title: string, text: string): Promise<String> {
  const frequencyMap = new Map<string, number>();
  return parseDocument(text, ["tokenize", "ssplit", "parse", "lemma", "pos"])
    .then((result: CoreNLP.simple.Document) => {
      let documentText = "";
      result.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
          const lemma = token.lemma();
          if (!frequencyMap.has(lemma)) {
            frequencyMap.set(lemma, 1);
          } else {
            frequencyMap.set(lemma, frequencyMap.get(lemma) + 1);
          }
          documentText += ` ${lemma}`;
        });
      });
      return new CorpusDocument({title, text: documentText}).save();
    })
    .then((document: CorpusDocumentModel) => {
      console.log("adding promises");
      const promises = [];
      for (const [lemma, frequency] of frequencyMap.entries()) {
        promises.push(addLemma(lemma, document._id, frequency));
      }
      return Promise.all(promises);
    })
    .then((results) => {
      return Promise.resolve(title);
    })
    .catch((err: Error) => {
      console.log(err);
      return Promise.reject(err);
    });
}
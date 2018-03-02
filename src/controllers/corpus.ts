import { Request, Response, NextFunction } from "express";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl, connector } from "../app";
import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, DocumentFrequency } from "../models/CorpusLemma";
import { parseDocument } from "../services/corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as async from "async";
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

export async function addDocumentToCorpus(title: string, text: string): Promise<boolean> {
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
      const cdoc = new CorpusDocument({title, text: documentText});
      return cdoc.save();
    })
    .then((document: CorpusDocumentModel) => {
      return async.map(frequencyMap.keys(), (lemma: string) => {
        const frequency = frequencyMap.get(lemma);
        CorpusLemma.findOne({lemma}).exec()
          .then((cLemma: CorpusLemma) => {
            if (cLemma) {
              // if lemma already exists add new doc lemma
              cLemma.frequencies.push({
                documentID: document.id,
                frequency: frequencyMap.get(lemma)
              });
              return cLemma.save();
            }
            else {
              // save new lemma
              const cLemma2 = new CorpusLemma({
                lemma,
                frequencies: [({
                  documentID: document._id,
                  frequency: frequency
                })]
              });
              return cLemma2.save();
            }
          })
          .catch((err: Error) => {
              throw err;
          });
      });
    })
    .then((results) => {
      console.log(`YO ${results}`);
      return Promise.resolve(true);
    })
    . catch((err: Error) => {
      console.log(err);
      return Promise.reject(err);
    });
}
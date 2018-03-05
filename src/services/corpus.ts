import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, DocumentFrequency } from "../models/CorpusLemma";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Schema } from "mongoose";
import { posFilter } from "../constants/posFilter";

export async function corpusIDF(lemma: string): Promise<number> {
    const corpusLemma = await CorpusLemma.findOne({lemma}).exec() as CorpusLemma;
    const collectionSize = await CorpusDocument.find().count();
    if (collectionSize) {
        const docsContainingLemma = (corpusLemma) ? corpusLemma.frequencies.length : 1;
        return Promise.resolve(Math.log(collectionSize / docsContainingLemma));
    }
    return Promise.reject("issue");
}

export async function addLemma(lemma: string, documentID: Schema.Types.ObjectId, frequency: number): Promise<CorpusLemma> {
    const corpusLemma = await CorpusLemma.findOne({lemma}).exec() as CorpusLemma;
    console.log("8 - lemma");
    if (corpusLemma) {
      const df: DocumentFrequency = {
        documentID,
        frequency
      };
      corpusLemma.frequencies.push(df);
      return corpusLemma.save();
    }
    else {
      const newCorpusLemma = new CorpusLemma({
        lemma,
        frequencies: [({
          documentID,
          frequency
        })]
      }) as CorpusLemma;
      return newCorpusLemma.save();
    }
  }

export async function addDocumentToCorpus(title: string, text: string): Promise<string> {
    console.log("5");
    const frequencyMap = new Map<string, number>();
    return parseDocument(text)
      .then((result: CoreNLP.simple.Document) => {
        console.log("6");
        let documentText = "";
        result.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
          sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            console.log(token.ner());
            if (posFilter.indexOf(token.pos()) === -1) {
              const lemma = token.lemma();
              if (!frequencyMap.has(lemma)) {
                frequencyMap.set(lemma, 1);
              } else {
                frequencyMap.set(lemma, frequencyMap.get(lemma) + 1);
              }
              documentText += ` ${lemma}`;
            }
          });
        });
        return new CorpusDocument({title, text: documentText}).save();
      })
      .then((document: CorpusDocumentModel) => {
        console.log("7");
        const promises = [];
        for (const [lemma, frequency] of frequencyMap.entries()) {
          promises.push(addLemma(lemma, document._id, frequency));
        }
        return Promise.all(promises);
      })
      .then((results: Array<CorpusLemma>) => {
        console.log("9");
        // potentially do something with results
        return Promise.resolve(title);
      })
      .catch((err: Error) => {
        return Promise.reject(err);
      });
}
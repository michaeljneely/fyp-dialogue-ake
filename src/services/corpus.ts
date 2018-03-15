import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma } from "../models/CorpusLemma";
import { DocumentFrequency } from "../models/DocumentFrequency";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { Schema } from "mongoose";
import { posFilter } from "../constants/posFilter";
import * as path from "path";
import * as fs from "fs-extra";
import { logger } from "../utils/logger";

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
    const frequencyMap = new Map<string, number>();
    return parseDocument(text, true)
        .then((result: CoreNLP.simple.Document) => {
            let documentText = "";
            result.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
                sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
                    if (posFilter.indexOf(token.pos()) === -1) {
                        const lemma = token.lemma();
                        if (!frequencyMap.has(lemma)) {
                            frequencyMap.set(lemma, 1);
                        }
                        else {
                            frequencyMap.set(lemma, frequencyMap.get(lemma) + 1);
                        }
                        documentText += ` ${lemma}`;
                    }
                });
            });
            return new CorpusDocument({title, text: documentText}).save();
        })
        .then((document: CorpusDocumentModel) => {
            const promises = [];
            for (const [lemma, frequency] of frequencyMap.entries()) {
                promises.push(addLemma(lemma, document._id, frequency));
            }
            return Promise.all(promises);
        })
        .then((results: Array<CorpusLemma>) => {
            // potentially do something with results
            return Promise.resolve(title);
        })
        .catch((err: Error) => {
            return Promise.reject(err);
        });
}

export async function buildCorpus(): Promise<Array<string>> {
    return CorpusDocument.remove({})
        .then(() => {
            return CorpusLemma.remove({});
        })
        .then(() => {
            return fs.readdir(path.join(__dirname, "../../corpus"));
        })
        .then((files: Array<string>) => {
            const promises: Array<Promise<string>> = [];
            files.forEach((filename: string) => {
                promises.push(fs.readFile(path.join(__dirname, "../../corpus", filename), "utf8"));
            });
            return Promise.all(promises);
        })
        .then((files: Array<string>) => {
            const promises: Array<Promise<string>> = [];
            files.forEach((file: string, index: number) => {
                promises.push(addDocumentToCorpus(`file ${index}`, file));
            });
            return Promise.all(promises);
        })
        .then((titles: Array<string>) => {
            titles.forEach((title: string) => {
                logger.info(`document '${title}' added to corpus.`);
            });
            return Promise.resolve(titles);
        })
        .catch((err: Error) => {
            return Promise.reject(err.message);
        });
}
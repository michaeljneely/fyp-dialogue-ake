import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, CorpusLemmaModel } from "../models/CorpusLemma";
import { DocumentFrequency, DocumentFrequencyModel } from "../models/DocumentFrequency";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as mongoose from "mongoose";
import { posFilter } from "../constants/posFilter";
import * as path from "path";
import * as fs from "fs-extra";
import { logger } from "../utils/logger";

export async function corpusIDF(lemma: string): Promise<number> {
    const corpusLemma = await CorpusLemmaModel.findOne({lemma}).exec() as CorpusLemma;
    const collectionSize = await CorpusDocumentModel.find().count();
    if (collectionSize) {
        const docsContainingLemma = (corpusLemma) ? corpusLemma.frequencies.length : 1;
        return Promise.resolve(Math.log(collectionSize / docsContainingLemma));
    }
    return Promise.reject("issue");
}

// REWRITE
export async function addLemma(lemma: string, documentID: mongoose.Schema.Types.ObjectId, frequency: number): Promise<CorpusLemma> {
    let corpusLemma = await CorpusLemmaModel.findOne({lemma});
    const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
    if (corpusLemma) {
        corpusLemma.frequencies.push(documentFrequency);
    }
    else {
        corpusLemma = new CorpusLemmaModel({lemma, frequencies: [documentFrequency]});
    }
    await corpusLemma.save();
    const result = await CorpusLemmaModel.findOne({lemma});
    return result;
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
                        if (frequencyMap.has(lemma)) {
                            frequencyMap.set(lemma, frequencyMap.get(lemma) + 1);
                        }
                        else {
                            frequencyMap.set(lemma, 1);
                        }
                        documentText += ` ${lemma}`;
                    }
                });
            });
            return new CorpusDocumentModel({title, text: documentText}).save();
        })
        .then((document: CorpusDocument & mongoose.Document) => {
            const promises = [];
            for (const [lemma, frequency] of frequencyMap.entries()) {
                promises.push(addLemma(lemma, document._id, frequency));
            }
            return Promise.all(promises);
        })
        .then((results: Array<CorpusLemma>) => {
            console.log(results.length);
            // potentially do something with results
            return Promise.resolve(results.length.toString());
        })
        .catch((err: Error) => {
            return Promise.reject(err);
        });
}

export async function buildCorpus(): Promise<Array<string>> {
    return CorpusDocumentModel.remove({})
        .then(() => {
            return CorpusLemmaModel.remove({});
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
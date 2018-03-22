import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, CorpusLemmaModel } from "../models/CorpusLemma";
import { DocumentFrequency, DocumentFrequencyModel } from "../models/DocumentFrequency";
import { parseDocument } from "./corenlp";
import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as mongoose from "mongoose";
import * as path from "path";
import * as fs from "fs-extra";
import { logger } from "../utils/logger";

export async function corpusIDF(lemma: string): Promise<number> {
    const corpusLemma = await CorpusLemmaModel.findOne({lemma});
    const collectionSize = await CorpusDocumentModel.find().count();
    if (collectionSize) {
        const docsContainingLemma = (corpusLemma) ? corpusLemma.frequencies.length : 1;
        return Promise.resolve(Math.log(collectionSize / docsContainingLemma));
    }
    return Promise.reject("issue");
}

export async function addLemma(lemma: string, documentID: mongoose.Types.ObjectId, frequency: number): Promise<CorpusLemma> {
    try {
        const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
        let corpusLemma = await CorpusLemmaModel.findOne({lemma});
        if (corpusLemma) {
            corpusLemma.frequencies.push(documentFrequency);
        }
        else {
            corpusLemma = new CorpusLemmaModel({lemma, frequencies: [documentFrequency]});
        }
        const saved = await corpusLemma.save();
        return Promise.resolve(saved);
    } catch (err) {
        return Promise.reject(err.message);
    }
}
export async function addDocumentToCorpus(title: string, text: string): Promise<string> {
    const frequencyMap = new Map<string, number>();
    try {
        const parsed = await parseDocument(text, true);
        let documentText = "";
        parsed.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
            sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
                const lemma = token.lemma();
                if (frequencyMap.has(lemma)) {
                    frequencyMap.set(lemma, frequencyMap.get(lemma) + 1);
                }
                else {
                    frequencyMap.set(lemma, 1);
                }
                documentText += ` ${lemma}`;
            });
         });
         const document = await new CorpusDocumentModel({title, text: documentText}).save();
         for (const [lemma, frequency] of frequencyMap.entries()) {
            await addLemma(lemma, document._id, frequency);
         }
         return Promise.resolve(document.title);
    } catch (err) {
        return Promise.reject(err.message);
    }
}

export async function buildCorpus(): Promise<Array<string>> {

    async function _readFiles(filenames: Array<string>) {
        const files = new Array<string>();
        for (const filename of filenames) {
            const file = await fs.readFile(path.join(__dirname, "../../corpus", filename), "utf8");
            files.push(file);
        }
        return files;
    }

    async function _addDocuments(documents: Array<string>) {
        const titles = new Array<string>();
        let index = 0;
        for (const document of documents) {
            const title = await addDocumentToCorpus(`file ${index}`, document);
            titles.push(title);
            index++;
        }
        return titles;
    }

    try {
        await CorpusDocumentModel.remove({});
        await CorpusLemmaModel.remove({});
        const filenames = await fs.readdir(path.join(__dirname, "../../corpus"));
        const files = await _readFiles(filenames);
        const titles = await _addDocuments(files);
        return Promise.resolve(titles);
    } catch (err) {
        logger.error(err);
        return Promise.reject(err);
    }
}
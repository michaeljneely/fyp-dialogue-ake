import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as fs from "fs-extra";
import * as mongoose from "mongoose";
import * as path from "path";
import { AlphaNumericRegex } from "../constants/filters";
import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, CorpusLemmaModel } from "../models/CorpusLemma";
import { DocumentFrequency, DocumentFrequencyModel } from "../models/DocumentFrequency";
import { IReference } from "../models/Reference";
import { logger } from "../utils/logger";
import { parseDocument } from "./corenlp";

export async function corpusIDF(lemma: string): Promise<number> {
    try {
        const corpusLemma = await CorpusLemmaModel.findOne({lemma});
        const collectionSize = await CorpusDocumentModel.find().count();
        if (collectionSize <= 0) {
            throw new Error("Corpus contains no documents");
        }
        const docsContainingLemma = (corpusLemma) ? corpusLemma.frequencies.length : 1;
        return Promise.resolve(Math.log2(collectionSize / docsContainingLemma));
    } catch (err) {
        return Promise.reject(err.message || err);
    }
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
        return Promise.reject(err.message || err);
    }
}
export async function addDocumentToCorpus(title: string, text: string, reference: IReference): Promise<string> {
    const frequencyMap = new Map<string, number>();
    try {
        const result = await parseDocument(text, true);
        const parsed = result.document;
        const speakers = result.speakers;
        let documentText = "";
        parsed.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
            sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
                if (AlphaNumericRegex.test(token.lemma())) {
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
         const document = await new CorpusDocumentModel({title, text: documentText, speakers, keywords: reference.keywords, referenceSummaries: reference.summaries}).save();
         for (const [lemma, frequency] of frequencyMap.entries()) {
            await addLemma(lemma, document._id, frequency);
         }
         return Promise.resolve(document.title);
    } catch (err) {
        return Promise.reject(err.message || err);
    }
}

export async function buildCorpus(): Promise<number> {

    async function _loadReferences(): Promise<Array<IReference>> {
        try {
            const filenames = await fs.readdir(path.join(__dirname, process.env.CORPUS_REFERENCE_LOCATION));
            const references = new Array<IReference>();
            for (const filename of filenames) {
                const reference = await fs.readJSON(path.join(__dirname, process.env.CORPUS_REFERENCE_LOCATION, filename)) as IReference;
                logger.info(reference.keywords.toString());
                if (!reference || !reference.textFile) {
                    const error = `Referred file does not exist for ${filename}`;
                    logger.error(error);
                    throw error;
                }
                references.push(reference);
            }
            return Promise.resolve(references);
        } catch (err) {
            return Promise.reject("Error loading references.");
        }

    }

    async function _addDocuments(references: Array<IReference>): Promise<Array<string>> {
        try {
            const titles = new Array<string>();
            let index = 0;
            for (const reference of references) {
                const text = await fs.readFile(path.join(__dirname, process.env.CORPUS_TEXT_LOCATION, reference.textFile), "utf8");
                const title = await addDocumentToCorpus(`file ${index}`, text, reference);
                if (!title) {
                    throw new Error("Error adding document to Corpus");
                }
                titles.push(title);
                index++;
            }
            return Promise.resolve(titles);
        } catch (err) {
            return Promise.reject("Error Adding Documents to Corpus.");
        }
    }

    try {
        await CorpusDocumentModel.remove({});
        await CorpusLemmaModel.remove({});
        const references = await _loadReferences();
        const titles = await _addDocuments(references);
        return Promise.resolve(titles.length);
    } catch (err) {
        logger.error(err);
        return Promise.reject(err);
    }
}
import CoreNLP from "corenlp";
import * as fs from "fs-extra";
import * as mongoose from "mongoose";
import * as path from "path";
import { ExtractedCandidateTerm, ExtractedCandidateTermMap } from "../../models/CandidateTerm";
import { CorpusCandidateTerm, CorpusCandidateTermModel } from "../../models/corpusCandidateTerm";
import { CorpusDocument, CorpusDocumentModel, referenceSummaries } from "../../models/CorpusDocument";
import { CorpusLemma, CorpusLemmaModel } from "../../models/CorpusLemma";
import { DocumentFrequencyModel } from "../../models/DocumentFrequency";
import { IReference } from "../../models/Reference";
import { replaceSmartQuotes, stripSpeakers } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { annotate } from "../corenlp/corenlp";
import { extractCandidateTermsFromCoreNLPDocument } from "../processors/candidateTerm";
import { extractMeaningfulLemmasFromCoreNLPDocument } from "../processors/lemma";

/**
 * Show basic information (title, id, speakers, keywords) on all corpus document
 * @returns {JSON} Array of document titles, id, speakers, and keywords
 */
export async function showAllDocuments(): Promise<JSON> {
    try {
        const documents = await CorpusDocumentModel.find();
        const json = documents.map((document) => { return {title: document.title, documentId: document._id, dateAdded: document.date.toUTCString(), speakers: document.speakers.join(", "), keywords: document.keywords.join(", ") }; });
        return Promise.resolve(JSON.parse(JSON.stringify(json)));
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Construct Corpus from scratch
 * @returns {number} Total number of documents in the new corpus
 */
export async function buildCorpus(): Promise<number> {

    async function _loadReferences(): Promise<Array<IReference>> {
        try {
            const filenames = await fs.readdir(process.env.CORPUS_REFERENCE_LOCATION);
            const references = new Array<IReference>();
            for (const filename of filenames) {
                const reference = await fs.readJSON(path.join(process.env.CORPUS_REFERENCE_LOCATION, filename)) as IReference;
                if (!reference || !reference.textFile) {
                    const error = `Referred file does not exist for ${filename}`;
                    logger.error(error);
                    throw error;
                }
                references.push(reference);
            }
            return Promise.resolve(references);
        } catch (error) {
            logger.error(error);
            return Promise.reject("Error loading references.");
        }

    }

    async function _addDocuments(references: Array<IReference>): Promise<number> {
        try {
            let numberAdded = 0;
            for (const reference of references) {
                const text = await fs.readFile(path.join(process.env.CORPUS_TEXT_LOCATION, reference.textFile), "utf8");
                const title = path.parse(path.join(process.env.CORPUS_TEXT_LOCATION, reference.textFile)).name;
                const [speakers, conversation] = stripSpeakers(text);
                const annotated = await annotate(replaceSmartQuotes(conversation));
                const terms = extractMeaningfulLemmasFromCoreNLPDocument(annotated);
                const candidateTerms = extractCandidateTermsFromCoreNLPDocument(annotated);
                await saveCorpusDocument(title, speakers, reference.keywords, annotated, text, terms, candidateTerms, reference.summaries);
                numberAdded++;
            }
            return Promise.resolve(numberAdded);
        } catch (error) {
            logger.error(error);
            return Promise.reject("Error Adding Documents to Corpus.");
        }
    }

    try {
        await CorpusDocumentModel.remove({});
        await CorpusLemmaModel.remove({});
        await CorpusCandidateTermModel.remove({});
        const references = await _loadReferences();
        const added = await _addDocuments(references);
        return Promise.resolve(added);
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Save a document and its corresponding lemmas and candidate terms in the Corpus
 * @param title Document Title
 * @param speakers The speakers in the conversation
 * @param keywords Keywords that are deemed to be important by a human
 * @param annotated CoreNLP document
 * @param rawText Raw conversation Text
 * @param lemmas Map of Unique lemmas and their frequencies
 * @param candidateTerms Map of Unique candidate terms and their frequencies
 * @param referenceSummaries User provided reference summaries
 */
export async function saveCorpusDocument(title: string, speakers: Array<string>, keywords: Array<string>, annotated: CoreNLP.simple.Document, rawText: string, lemmas: Map<string, number>, candidateTerms: ExtractedCandidateTermMap, referenceSummaries: referenceSummaries): Promise<CorpusDocument & mongoose.Document> {
    try {
        const corpusDocument = await new CorpusDocumentModel({
            title: title,
            date: Date.now(),
            rawText,
            processedText: JSON.parse(JSON.stringify(annotated.toJSON())),
            speakers,
            keywords,
            referenceSummaries
        }).save();
        if (corpusDocument) {
            for (const [lemma, frequency] of lemmas.entries()) {
                await addCorpusLemma(corpusDocument._id, lemma, frequency);
            }
            for (const [candidateTerm, frequency] of candidateTerms) {
                await addCorpusCandidateTerm(corpusDocument._id, candidateTerm, frequency);
            }
            return Promise.resolve(corpusDocument);
        }
        else throw "Document could not be saved at this time";
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Add a Lemma to the Corpus
 * @param documentID Parent document ID
 * @param lemma Lemma
 * @param frequency Total occurrences in conversation
 */
async function addCorpusLemma(documentID: mongoose.Types.ObjectId, lemma: string, frequency: number): Promise<CorpusLemma> {
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
        if (saved) {
            return Promise.resolve(saved);
        }
        else throw "Lemma could not be saved";
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Add a candidate term to the corpus
 * @param documentID Parent document ID
 * @param candidateTerm  Candidate Term
 * @param frequency Total occurrences in conversation
 */
async function addCorpusCandidateTerm(documentID: mongoose.Types.ObjectId, candidateTerm: ExtractedCandidateTerm, frequency: number): Promise<CorpusCandidateTerm > {
    try {
        const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
        let corpusCandidateTerm = await CorpusCandidateTermModel.findOne({ term: candidateTerm.term, type: candidateTerm.type });
        if (corpusCandidateTerm) {
            corpusCandidateTerm.frequencies.push(documentFrequency);
        }
        else {
            corpusCandidateTerm = new CorpusCandidateTermModel({term: candidateTerm.term, type: candidateTerm.type, frequencies: [documentFrequency]});
        }
        const saved = await corpusCandidateTerm.save();
        if (saved) {
            return Promise.resolve(saved);
        }
        else throw "Candidate term could not be saved";
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

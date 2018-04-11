import CoreNLP from "corenlp";
import * as mongoose from "mongoose";
import { CandidateTerm, UserCandidateTerm, UserCandidateTermModel } from "../../models/CandidateTerm";
import { UserDocument, UserDocumentModel } from "../../models/Document";
import { DocumentFrequencyModel } from "../../models/DocumentFrequency";
import { UserLemma, UserLemmaModel } from "../../models/Lemma";
import { logger } from "../../utils/logger";

/**
 * Save a document and its corresponding lemmas and candidate terms to the user's unique Corpus
 * @param userId User ID
 * @param speakers The speakers in the conversation
 * @param annotated CoreNLP document
 * @param rawText Raw conversation Text
 * @param lemmas Map of Unique lemmas and their frequencies
 * @param candidateTerms Map of Unique candidate terms and their frequencies
 */
export async function saveUserDocument(userId: mongoose.Types.ObjectId, speakers: Array<string>, annotated: CoreNLP.simple.Document, rawText: string, lemmas: Map<string, number>, candidateTerms: Map<string, number>): Promise<UserDocument> {
    try {
        const userDocument = await new UserDocumentModel({
            owner: userId,
            date: Date.now(),
            rawText,
            processedText: JSON.parse(JSON.stringify(annotated.toJSON())),
            speakers
        }).save();
        if (userDocument) {
            for (const [lemma, frequency] of lemmas.entries()) {
                await addUserLemma(userId, userDocument._id, lemma, frequency);
            }
            for (const [candidateTerm, frequency] of candidateTerms) {
                await addUserCandidateTerm(userId, userDocument._id, CandidateTerm.fromString(candidateTerm), frequency);
            }
            return Promise.resolve(userDocument);
        }
        else throw "Document could not be saved at this time";
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Add a Lemma to the User's Corpus
 * @param userId User ID
 * @param documentID Parent Document ID
 * @param lemma Lemma
 * @param frequency Total occurrences in conversation
 */
async function addUserLemma(userId: mongoose.Types.ObjectId, documentID: mongoose.Types.ObjectId, lemma: string, frequency: number): Promise<UserLemma> {
    try {
        const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
        let userLemma = await UserLemmaModel.findOne({owner: userId, lemma});
        if (userLemma) {
            userLemma.frequencies.push(documentFrequency);
        }
        else {
            userLemma = new UserLemmaModel({owner: userId, lemma, frequencies: [documentFrequency]});
        }
        const saved = await userLemma.save();
        if (saved) {
            return Promise.resolve(saved);
        }
        else throw "Lemma could not be saved";
    } catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * Add a Candidate Term to the User's Corpus
 * @param userId User ID
 * @param documentID Parent Document ID
 * @param candidateTerm Candidate Term
 * @param frequency Total occurrences in conversation
 */
async function addUserCandidateTerm(userId: mongoose.Types.ObjectId, documentID: mongoose.Types.ObjectId, candidateTerm: CandidateTerm, frequency: number): Promise<UserCandidateTerm > {
    try {
        const documentFrequency = new DocumentFrequencyModel({ documentID, frequency });
        let userCandidateTerm = await UserCandidateTermModel.findOne({ owner: userId, term: candidateTerm.term, type: candidateTerm.type });
        if (userCandidateTerm) {
            userCandidateTerm.frequencies.push(documentFrequency);
        }
        else {
            userCandidateTerm = new UserCandidateTermModel({owner: userId, term: candidateTerm.term, type: candidateTerm.type, frequencies: [documentFrequency]});
        }
        const saved = await userCandidateTerm.save();
        if (saved) {
            return Promise.resolve(saved);
        }
        else throw "Candidate term could not be saved";
    } catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

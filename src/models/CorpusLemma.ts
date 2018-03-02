import * as mongoose from "mongoose";

export interface DocumentFrequency {
    documentID: mongoose.Schema.Types.ObjectId;
    frequency: number;
}

export interface CorpusLemma extends mongoose.Document {
    lemma: string;
    frequencies: Array<DocumentFrequency>;
}

const DocumentFrequencySchema = new mongoose.Schema({
    documentID: mongoose.Schema.Types.ObjectId,
    frequency: Number
});

const CorpusLemmaSchema = new mongoose.Schema({
    lemma: String,
    frequencies: [DocumentFrequencySchema]
});
export const CorpusLemma = mongoose.model("CorpusLemma", CorpusLemmaSchema);
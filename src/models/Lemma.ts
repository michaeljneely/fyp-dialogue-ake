import * as mongoose from "mongoose";
import DocumentFrequency, { DocumentFrequencyModel } from "./DocumentFrequency";
import { Origin } from "../types/origin";
export type LemmaModel = mongoose.Document & {
    lemma: string,
    origin: Origin,
    frequencies: Array<DocumentFrequencyModel>
};

const lemmaSchema = new mongoose.Schema({
    lemma: String,
    origin: mongoose.Schema.Types.Mixed,
    frequencies: [DocumentFrequency]
});

const Lemma = mongoose.model("Lemma", lemmaSchema);
export default Lemma;
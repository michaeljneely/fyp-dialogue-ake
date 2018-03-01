import * as mongoose from "mongoose";
import { Origin } from "../types/origin";

export type CorpusDocumentModel = mongoose.Document & {
    title: string,
    text: string
};

const corpusDocumentSchema = new mongoose.Schema({
    title: String,
    text: String
});

const CorpusDocument = mongoose.model("CorpusDocument", corpusDocumentSchema);
export default CorpusDocument;
import * as mongoose from "mongoose";
import { Origin } from "../types/origin";

export type DocumentModel = mongoose.Document & {
    origin: Origin,
    text: string
};

const documentSchema = new mongoose.Schema({
    origin: mongoose.Schema.Types.Mixed,
    text: String
});

const Document = mongoose.model("Document", documentSchema);
export default Document;
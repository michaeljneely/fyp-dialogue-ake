import * as mongoose from "mongoose";
import { Origin } from "../types/origin";

export type UserDocumentModel = mongoose.Document & {
    owner: mongoose.Schema.Types.ObjectId,
    date: Date,
    text: string,
    length: number,
    summaries: Array<string>
};

const userDocumentSchema = new mongoose.Schema({
    owner: mongoose.Schema.Types.ObjectId,
    date: mongoose.Schema.Types.Date,
    text: String,
    length: Number,
    summaries: [String]
});

const UserDocument = mongoose.model("UserDocument", userDocumentSchema);
export default UserDocument;
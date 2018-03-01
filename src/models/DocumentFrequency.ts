import * as mongoose from "mongoose";

export type DocumentFrequencyModel = mongoose.Document & {
    documentID: mongoose.Schema.Types.ObjectId,
    frequency: number
};

const documentFrequencySchema = new mongoose.Schema({
    documentID: mongoose.Schema.Types.ObjectId,
    frequency: Number
});

const DocumentFrequency = mongoose.model("DocumentFrequency", documentFrequencySchema);
export default DocumentFrequency;
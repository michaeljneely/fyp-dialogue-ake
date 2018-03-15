import { Schema } from "mongoose";

export interface DocumentFrequency {
    documentID: Schema.Types.ObjectId;
    frequency: number;
}

export const DocumentFrequencySchema = new Schema({
    documentID: Schema.Types.ObjectId,
    frequency: Number
});

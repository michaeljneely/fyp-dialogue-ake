import * as mongoose from "mongoose";
import { prop, Typegoose } from "typegoose";

export class DocumentFrequency extends Typegoose {
    @prop({ required: true })
    documentID: mongoose.Types.ObjectId;
    @prop({ required: true })
    frequency: number;
}

export const DocumentFrequencyModel = new DocumentFrequency().getModelForClass(DocumentFrequency);

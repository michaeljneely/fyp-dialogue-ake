import { prop, Typegoose, ModelType, InstanceType } from "typegoose";
import * as mongoose from "mongoose";

export class CorpusDocument extends Typegoose {
    @prop({ required: true })
    title: string;
    @prop({ required: true })
    text: string;
}

export const CorpusDocumentModel = new CorpusDocument().getModelForClass(CorpusDocument);

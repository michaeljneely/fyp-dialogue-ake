import * as mongoose from "mongoose";
import { InstanceType, ModelType, prop, Typegoose } from "typegoose";
export class CorpusDocument extends Typegoose {
    @prop({ required: true })
    title: string;
    @prop({ required: true })
    text: string;
    @prop()
    speakers: Array<string>;
    @prop()
    keywords: Array<string>;
    @prop()
    referenceSummaries: {
        short: string,
        medium: string,
        long: string
    };
}

export const CorpusDocumentModel = new CorpusDocument().getModelForClass(CorpusDocument);

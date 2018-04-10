import * as mongoose from "mongoose";
import { prop, Typegoose } from "typegoose";

export class CorpusDocument extends Typegoose {
    @prop({required: true, index: true})
    title: String;
    @prop()
    date: Date;
    @prop({ required: true })
    rawText: string;
    @prop({ required: true })
    processedText: JSON;
    @prop()
    speakers: Array<string>;
    @prop()
    keywords: Array<string>;
    @prop()
    referenceSummaries: referenceSummaries;
}

export type referenceSummaries = {
    short: string,
    medium: string,
    long: string
};

export const CorpusDocumentModel = new CorpusDocument().getModelForClass(CorpusDocument, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

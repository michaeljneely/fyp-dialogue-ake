import * as mongoose from "mongoose";
import { prop, Typegoose } from "typegoose";
import { ReferenceSummaries } from "./Reference";

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
    referenceSummaries: ReferenceSummaries;
}

export const CorpusDocumentModel = new CorpusDocument().getModelForClass(CorpusDocument, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

export class UserDocument extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Types.ObjectId;
    @prop({ required: true })
    date: Date;
    @prop({ required: true })
    rawText: string;
    @prop({ required: true })
    processedText: JSON;
    @prop()
    text: string;
    @prop()
    length: number;
    @prop()
    speakers: Array<string>;
}

export const UserDocumentModel = new UserDocument().getModelForClass(UserDocument, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

import { prop, Typegoose, ModelType, InstanceType } from "typegoose";
import * as mongoose from "mongoose";

export type Summaries = {
    length: number,
    tfidf: string,
    tfiudf: string,
    random: string,
    lda: string
};

export class UserDocument extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Schema.Types.ObjectId;
    @prop({ required: true })
    date: Date;
    @prop({ required: true })
    text: string;
    @prop({ required: true })
    length: number;
    @prop()
    speakers: Array<string>;
    @prop()
    summaries: Summaries;
}
export const UserDocumentModel = new UserDocument().getModelForClass(UserDocument);

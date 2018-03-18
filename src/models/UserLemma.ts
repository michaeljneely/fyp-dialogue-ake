import { arrayProp, prop, Typegoose, ModelType, InstanceType } from "typegoose";
import * as mongoose from "mongoose";
import { DocumentFrequency } from "./DocumentFrequency";

export class UserLemma extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Schema.Types.ObjectId;
    @prop({ required: true })
    lemma: string;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const UserLemmaModel = new UserLemma().getModelForClass(UserLemma);

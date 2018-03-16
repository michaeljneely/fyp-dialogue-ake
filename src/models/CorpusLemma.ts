import { prop, Typegoose, ModelType, InstanceType } from "typegoose";
import * as mongoose from "mongoose";
import { DocumentFrequency } from "./DocumentFrequency";

export class CorpusLemma extends Typegoose {
    @prop({ required: true })
    lemma: string;
    @prop({ required: true })
    frequencies: Array<DocumentFrequency>;
}

export const CorpusLemmaModel = new CorpusLemma().getModelForClass(CorpusLemma);

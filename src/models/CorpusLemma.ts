import { arrayProp, prop, Typegoose, ModelType, InstanceType } from "typegoose";
import * as mongoose from "mongoose";
import { DocumentFrequency } from "./DocumentFrequency";

export class CorpusLemma extends Typegoose {
    @prop({ required: true })
    lemma: string;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const CorpusLemmaModel = new CorpusLemma().getModelForClass(CorpusLemma);

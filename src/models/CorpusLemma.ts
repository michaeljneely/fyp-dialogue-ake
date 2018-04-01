import * as mongoose from "mongoose";
import { arrayProp, InstanceType, ModelType, prop, Typegoose } from "typegoose";
import { DocumentFrequency } from "./DocumentFrequency";

export class CorpusLemma extends Typegoose {
    @prop({ required: true })
    lemma: string;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const CorpusLemmaModel = new CorpusLemma().getModelForClass(CorpusLemma);

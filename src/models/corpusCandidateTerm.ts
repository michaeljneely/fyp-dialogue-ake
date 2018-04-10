import * as mongoose from "mongoose";
import { arrayProp, prop, Typegoose } from "typegoose";
import { CandidateTermTypes } from "./CandidateTerm";
import { DocumentFrequency } from "./DocumentFrequency";

export class CorpusCandidateTerm extends Typegoose {
    @prop({ required: true, index: true })
    term: string;
    @prop({ required: true })
    type: CandidateTermTypes;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const CorpusCandidateTermModel = new CorpusCandidateTerm().getModelForClass(CorpusCandidateTerm, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

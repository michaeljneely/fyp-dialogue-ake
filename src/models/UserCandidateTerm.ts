import * as mongoose from "mongoose";
import { arrayProp, prop, Typegoose } from "typegoose";
import { CandidateTermTypes } from "./CandidateTerm";
import { DocumentFrequency } from "./DocumentFrequency";

export class UserCandidateTerm extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Schema.Types.ObjectId;
    @prop({ required: true, index: true })
    term: string;
    @prop({ required: true })
    type: CandidateTermTypes;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const UserCandidateTermModel = new UserCandidateTerm().getModelForClass(UserCandidateTerm);

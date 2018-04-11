import * as mongoose from "mongoose";
import { arrayProp, InstanceType, ModelType, prop, Typegoose } from "typegoose";
import { DocumentFrequency } from "./DocumentFrequency";
import { Term } from "./Term";

export type CandidateTermTypes = "NOUN" | "COMPOUND NOUN" | "ENTITY";

export class CorpusCandidateTerm extends Typegoose {
    @prop({ required: true })
    term: string;
    @prop()
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

export class UserCandidateTerm extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Types.ObjectId;
    @prop({ required: true, index: true })
    term: string;
    @prop({ required: true })
    type: CandidateTermTypes;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const UserCandidateTermModel = new UserCandidateTerm().getModelForClass(UserCandidateTerm, {
    existingConnection: mongoose.connection,
    schemaOptions: {
        timestamps: true
    }
});

export class CandidateTerm extends Term {
    private _ctType: CandidateTermTypes;
    constructor(term: string, type: CandidateTermTypes) {
        super(term, type.toString());
        this._ctType = type;
    }

    public get ctType() {
        return this._ctType;
    }

    public equals(t: Term): boolean {
        return this._term === t.term;
    }

    public static toString(entity: CandidateTerm): string {
        return `${entity.term}//${entity.ctType}`;
    }

    public static fromString(entityString: string): CandidateTerm {
        const split = entityString.split("//");
        if (split.length !== 2) {
            throw "Incompatible string";
        }
        if (!split[0] || !split[1]) {
            throw "Incompatible string";
        }
        const term = split[0];
        const type = split[1] as CandidateTermTypes;
        return new CandidateTerm(term, type);
    }
}

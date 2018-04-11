import * as mongoose from "mongoose";
import { arrayProp, InstanceType, ModelType, prop, Typegoose } from "typegoose";
import { DocumentFrequency } from "./DocumentFrequency";

export class Term {
    protected _term: string;
    protected _type: string;

    constructor(term: string, type: string) {
        this._term = term;
        this._type = type;
    }
    public get term() {
        return this._term;
    }

    public get type() {
        return this._type;
    }

    public static equals(t1: Term, t2: Term) {
        return ( (t1.term === t2.term) && (t1.type === t2.type));
    }

    public static toString(term: Term): string {
        return `${term.term}//${term.type}`;
    }

    public static fromString(termString: string): Term {
        const split = termString.split("//");
        if (split.length !== 2) {
            throw "Incompatible string";
        }
        if (!split[0] || !split[1]) {
            throw "Incompatible string";
        }
        const term = split[0];
        const type = split[1];
        return new Term(term, type);
    }
}

export class CorpusTerm extends Typegoose {
    @prop({ required: true })
    term: string;
    @prop()
    type: string;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const CorpusTermModel = new CorpusTerm().getModelForClass(CorpusTerm, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});


export class UserTerm extends Typegoose {
    @prop({ required: true, index: true })
    owner: mongoose.Types.ObjectId;
    @prop({ required: true, index: true })
    term: string;
    @prop({ required: true })
    type: string;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const UserTermModel = new UserTerm().getModelForClass(UserTerm, {
    existingConnection: mongoose.connection,
    schemaOptions: {
        timestamps: true
    }
});

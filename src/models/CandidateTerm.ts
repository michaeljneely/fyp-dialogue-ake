import * as mongoose from "mongoose";
import { arrayProp, InstanceType, ModelType, prop, Typegoose } from "typegoose";
import { DocumentFrequency } from "./DocumentFrequency";
import { Term } from "./NamedEntityTerm";

export enum CandidateTermTypes {
    Noun,
    CompoundNoun,
    Entity
}

export class CandidateTerm extends Typegoose {
    @prop({ required: true })
    term: string;
    @prop()
    type: CandidateTermTypes;
    @arrayProp({ items: DocumentFrequency })
    frequencies: Array<DocumentFrequency>;
}

export const CandidateTermModel = new CandidateTerm().getModelForClass(CandidateTerm, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});


export class ExtractedCandidateTerm extends Term {
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
}

interface ECTIterable {
    [Symbol.iterator](): IterableIterator<[ExtractedCandidateTerm, number]>;
  }
export class ExtractedCandidateTermMap implements ECTIterable {
    *[Symbol.iterator]() {
        for (const i of this._store) {
            yield i;
        }
    }

    private _store: Array<[ExtractedCandidateTerm, number]>;
    private _pointer: number;

    constructor() {
        this._store = new Array<[ExtractedCandidateTerm, number]>();
    }

    public set (ect: ExtractedCandidateTerm, frequency: number): void {
        const yo = this._store.find((term) => term["0"].equals(ect));
        if (yo) {
            yo["1"] = frequency;
        }
        else {
            this._store.push([ect, frequency]);
        }
    }

    public get (ect: ExtractedCandidateTerm): [ExtractedCandidateTerm, number] {
        return this._store.find((term) => term["0"].equals(ect));
    }

    public size(): number {
        return this._store.length;
    }

    public store(): Array<[ExtractedCandidateTerm, number]> {
        return this._store;
    }

    public toSortedString(): string {
        const terms = this._store.map(([ect, frequency]) => {
            return ect.term;
        });
        return terms.sort().toString().split(",").join(" ");
    }

    public toStringArray(): Array<string> {
        return this._store.map(([ect, frequency]) => {
            return ect.term;
        });
    }
}

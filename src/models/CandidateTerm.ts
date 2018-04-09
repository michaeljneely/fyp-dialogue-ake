import * as mongoose from "mongoose";
import { arrayProp, InstanceType, ModelType, prop, Typegoose } from "typegoose";
import { DocumentFrequency } from "./DocumentFrequency";

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

export const CandidateTermModel = new CandidateTerm().getModelForClass(CandidateTerm);


export class ExtractedCandidateTerm {
    private _term: string;
    private _type: CandidateTermTypes;
    constructor(term: string, type: CandidateTermTypes) {
        this._term = term;
        this._type = type;
    }

    public get term() {
        return this._term;
    }

    public get type() {
        return this._type;
    }
    public equals(ect: ExtractedCandidateTerm): boolean {
        return ((this._term === ect.term) && (this._type === ect.type));
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

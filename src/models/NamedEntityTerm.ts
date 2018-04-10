type EntityTypeNamed = "PERSON" | "LOCATION" | "ORGANIZATION" | "MISC" | "COUNTRY" | "NATIONALITY" | "COUNTRY" | "STATE_OR_PROVENCE" | "TITLE" | "IDEOLOGY" | "RELIGION" | "CRIMINAL_CHARGE" | "CAUSE_OF_DEATH";

type EntityTypeNumber =  | "MONEY" | "NUMBER" | "ORDINAL" | "PERCENT";
type EntityTypeDuration = "DATE" | "TIME" | "DURATION" | "SET";

type EntityTypeNull = "O";

export type EntityType = EntityTypeNamed | EntityTypeNumber | EntityTypeDuration | EntityTypeNull;

export abstract class Term {
    protected _term: string;

    constructor(term: string) {
        this._term = term;
    }
    public get term() {
        return this._term;
    }
}

export class NamedEntityTerm extends Term {
    private _type: EntityType;
    constructor(term: string, type: EntityType) {
        super(term);
        this._type = type;
    }
    public get type() {
        return this._type;
    }

    public equals(t: Term): boolean {
        return this._term === t.term;
    }

}

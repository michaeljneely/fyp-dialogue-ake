import { logger } from "../utils/logger";

type EntityTypeNamed = "PERSON" | "LOCATION" | "ORGANIZATION" | "MISC" | "COUNTRY" | "NATIONALITY" | "COUNTRY" | "STATE_OR_PROVENCE" | "TITLE" | "IDEOLOGY" | "RELIGION" | "CRIMINAL_CHARGE" | "CAUSE_OF_DEATH";

type EntityTypeNumber =  | "MONEY" | "NUMBER" | "ORDINAL" | "PERCENT";
type EntityTypeDuration = "DATE" | "TIME" | "DURATION" | "SET";

type EntityTypeNull = "O";

export type EntityType = EntityTypeNamed | EntityTypeNumber | EntityTypeDuration | EntityTypeNull;

export abstract class Term {
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
}

export class NamedEntityTerm extends Term {
    private _entityType: EntityType;
    constructor(term: string, type: EntityType) {
        super(term, type as string);
        this._entityType = type;
    }
    public get entityType() {
        return this._entityType;
    }

    public equals(entity: Term): boolean {
        return this._term === entity.term;
    }

    public static equals(entity1: NamedEntityTerm, entity2: NamedEntityTerm): boolean {
        return ((entity1.term === entity2.term) && (entity1.type === entity2.type));
    }

    public static toString(entity: NamedEntityTerm): string {
        return `${entity.term}//${entity.entityType}`;
    }

    public static fromString(entityString: string): NamedEntityTerm {
        const split = entityString.split("//");
        if (split.length !== 2) {
            throw "Incompatible string";
        }
        if (!split[0] || !split[1]) {
            throw "Incompatible string";
        }
        const term = split[0];
        const type = split[1] as EntityType;
        return new NamedEntityTerm(term, type);
    }
}

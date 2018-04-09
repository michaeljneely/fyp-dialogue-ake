import CoreNLP from "corenlp";
import { Stack } from "../../utils/stack";

/*
    Service to abstract processing of Named Entities
*/

export type entityNamed = "PERSON" | "LOCATION" | "ORGANIZATION" | "MISC";
export type entityNumerical = "MONEY" | "NUMBER" | "ORDINAL" | "PERCENT";
export type entityTemporal = "DATE" | "TIME" | "DURATION" | "SET";
export type entityNone = "O";
export type NamedEntity = entityNamed | entityNumerical | entityTemporal | entityNone;


export interface NamedEntityTerm {
    term: string;
    entityType: NamedEntity;
}

/**
 * Extract all Named Entities from a CoreNLP Document
 * @param {CoreNLP.simple.Document} annotated CoreNLP Document
 */
export function extractNamedEntitiesFromCoreNLPDocument(annotated: CoreNLP.simple.Document): Array<NamedEntityTerm> {
    const entities = new Array<NamedEntityTerm>();
    const entityStack = new Stack<NamedEntityTerm>();
    annotated.sentences().forEach((sentence) => {
        sentence.tokens().forEach((token) => {
            const ner = token.ner() as NamedEntity;
            if (ner !== "O") {
                const top = entityStack.peek();
                if (top && top.entityType !== ner) {
                    entities.push(flushEntityStack(entityStack));
                    entityStack.clear();
                }
                entityStack.push({
                    term: token.word(),
                    entityType: ner,
                });
            }
        });
        const top = entityStack.peek();
        if (top) {
            entities.push(flushEntityStack(entityStack));
        }
        // flush at end of sentence
        entityStack.clear();
    });
    return entities;
}

/**
 * Combine a stack of NamedEntityTerms into a single one
 * @param {Stack<NamedEntityTerm>} stack
 */
function flushEntityStack(stack: Stack<NamedEntityTerm>): NamedEntityTerm {
    const ret: NamedEntityTerm = {
        term: "",
        entityType: undefined
    };
    stack.data().forEach((net: NamedEntityTerm) => {
        ret.term = ret.term.concat(" " + net.term.toLowerCase());
        ret.entityType = (ret.entityType === net.entityType) ? ret.entityType : net.entityType;
    });
    ret.term = ret.term.trim();
    return ret;
}

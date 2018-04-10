import CoreNLP from "corenlp";
import { EntityType, NamedEntityTerm } from "../../models/NamedEntityTerm";
import { Stack } from "../../utils/stack";

/*
    Service to abstract processing of Named Entities
*/

/**
 * Extract all Named Entities from a CoreNLP Document
 * @param {CoreNLP.simple.Document} annotated CoreNLP Document
 */
export function extractNamedEntitiesFromCoreNLPDocument(annotated: CoreNLP.simple.Document): Array<NamedEntityTerm> {
    const entities = new Array<NamedEntityTerm>();
    const entityStack = new Stack<NamedEntityTerm>();
    annotated.sentences().forEach((sentence) => {
        sentence.tokens().forEach((token) => {
            const ner = token.ner() as EntityType;
            if (ner !== "O") {
                const top = entityStack.peek();
                if (top && top.type !== ner) {
                    entities.push(flushEntityStack(entityStack));
                    entityStack.clear();
                }
                entityStack.push(new NamedEntityTerm(token.word().toLowerCase(), ner));
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
    let term: string = "";
    let type: EntityType;
    stack.data().forEach((net: NamedEntityTerm) => {
        term = term.concat(" " + net.term.toLowerCase());
        type = (type === net.type) ? type : net.type;
    });
    term = term.trim();
    return new NamedEntityTerm(term, type);
}

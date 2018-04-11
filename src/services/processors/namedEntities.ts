import CoreNLP from "corenlp";
import { EntityType, NamedEntityTerm } from "../../models/NamedEntityTerm";
import { logger } from "../../utils/logger";
import { Stack } from "../../utils/stack";

/*
    Service to abstract processing of Named Entities
*/

/**
 * Extract all Named Entities from a CoreNLP Document
 * @param {CoreNLP.simple.Document} annotated CoreNLP Document
 */

export function extractNamedEntitiesFromCoreNLPDocument(document: CoreNLP.simple.Document): Map<string, number> {
    return mapNamedEntities(findNamedEntities(document));
}

export function findNamedEntities(annotated: CoreNLP.simple.Document): Array<NamedEntityTerm> {
    logger.info(`findNameEntities() - finding named entities...`);
    const entities = new Array<NamedEntityTerm>();
    const entityStack = new Stack<NamedEntityTerm>();
    let tokenCount = 0;
    annotated.sentences().forEach((sentence) => {
        const tokens = sentence.tokens();
        tokenCount += tokens.length;
        for (let i = 0; i < tokens.length; i++) {
            const ner = tokens[i].ner() as EntityType;
            if (ner !== "O") {
                const top = entityStack.peek();
                if (top && top.type !== ner) {
                    entities.push(flushEntityStack(entityStack));
                    entityStack.clear();
                }
                entityStack.push(new NamedEntityTerm(tokens[i].word().toLowerCase(), ner));
            }
            else if (i > 0 && tokens[i - 1].ner() !== ner) {
                entities.push(flushEntityStack(entityStack));
                entityStack.clear();
            }
        }
        const top = entityStack.peek();
        if (top) {
            entities.push(flushEntityStack(entityStack));
        }
        // flush at end of sentence
        entityStack.clear();
    });
    logger.info(`Extracted ${entities.length} non-unique Named Entities out of ${tokenCount} tokens`);
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
        type = (type === net.entityType) ? type : net.entityType;
    });
    term = term.trim();
    return new NamedEntityTerm(term, type);
}

function mapNamedEntities(namedEntities: Array<NamedEntityTerm>): Map<string, number> {
    const map = new Map<string, number>();
    namedEntities.forEach((entity) => {
        const existing = map.get(NamedEntityTerm.toString(entity));
        if (existing) {
            map.set(NamedEntityTerm.toString(entity), existing + 1);
        }
        else {
            map.set(NamedEntityTerm.toString(entity), 1);
        }
    });
    return map;
}

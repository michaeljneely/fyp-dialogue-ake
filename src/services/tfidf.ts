import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";

const props = new Properties({
    annotators: "tokenize,ssplit,lemma",
});

const testMAP = new Map<string, number>();
interface IJSON {
    [key: string]: JSON;
}

interface ITF {
    lemma: string;
    freq: number;
}

const acceptable = ["NN"];


function getMaxTF(map: Map<string, number>): ITF {
    const lemma: string = [...map.keys()].filter((lemma: string) => {
        return map.get(lemma) == Math.max.apply(undefined, [...map.values()]);
    }).pop();
    const ret: ITF = {
        lemma,
        freq: map.get(lemma)
    };
    map.delete(lemma);
    return ret;
}

export async function tfidf(connector: ConnectorServer, document: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const yo = new Array<string>();
    // const processed = document.replace(/[^A-Za-zА-Яа-я0-9_']+/, "");
    // console.log(processed);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    result.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            if (acceptable.indexOf(token.pos()) > -1) {
                const lemma: string = token.lemma();
                if (testMAP.has(lemma)) {
                    testMAP.set(lemma, testMAP.get(lemma) + 1);
                } else {
                    testMAP.set(lemma, 1);
                }
            }
        });
    });
    console.log(getMaxTF(testMAP));
    return undefined;
}
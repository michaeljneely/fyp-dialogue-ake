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


function getMaxTF(map: Map<string, number>): ITF {
    const lemma: string = [...map.keys()].filter((lemma: string) => {
        return map.get(lemma) == Math.max.apply(undefined, [...map.values()]);
    }).pop();
    return {
        lemma,
        freq: map.get(lemma)
    };
}

export async function tfidf(connector: ConnectorServer, document: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    result.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.lemmas().forEach((lemma: string) => {
            console.log(lemma);
            if (testMAP.has(lemma)) {
                testMAP.set(lemma, testMAP.get(lemma) + 1);
            } else {
                testMAP.set(lemma, 1);
            }
        });
    });
    console.log(getMaxTF(testMAP));
    return undefined;
    // result.sentences().forEach((sentence: CoreNLP.simple.Sentence, index: number) => {
    //     console.log(sentence.parse());
    // });
    // return undefined;
}
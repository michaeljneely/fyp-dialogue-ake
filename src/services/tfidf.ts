import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";

const props = new Properties({
    annotators: "tokenize,ssplit,lemma",
});

const posFilter = ["CD", "FW", "JJ", "JJR", "JJS", "NN", "NNS", "NNP", "NNPS", "RB", "RBR", "RBS", "VB", "VBG", "VBN", "VBP", "VBZ"];

type TermMap = Map<string, Term>;

type Term = {
    lemma: string;
    rawFrequencyTF: number;
    dlNormalizedTf: number;
    logNormalizedTF: number;
    doubleNormalizedTF: number;
};

// raw tf
// document length normalized tf
// logarithmic normalized tf
// double normalized tf

function buildTermFrequencyMapFromNLPDocument(document: CoreNLP.simple.Document): TermMap {
    let documentLength = 0;
    const freqMap = new Map<string, Term>();
    const highestTerm: Term = {
        lemma: "",
        rawFrequencyTF: 0,
        dlNormalizedTf: 0,
        logNormalizedTF: 0,
        doubleNormalizedTF: 0,
    };
    document.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
        sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
            if (posFilter.indexOf(token.pos()) > -1) {
                const lemma: string = token.lemma();
                if (!freqMap.has(lemma)) {
                    freqMap.set(lemma, {
                        lemma,
                        rawFrequencyTF: 1,
                        dlNormalizedTf: 0,
                        logNormalizedTF: 0,
                        doubleNormalizedTF: 0,
                    });
                } else {
                    const currentTF = freqMap.get(lemma).rawFrequencyTF++;
                    if (currentTF > highestTerm.rawFrequencyTF) {
                        highestTerm.rawFrequencyTF = currentTF;
                        highestTerm.lemma = lemma;
                    }
                }
                documentLength++;
            }
        });
    });
    for (const [key, value] of freqMap) {
        value.dlNormalizedTf = value.rawFrequencyTF / documentLength;
        value.logNormalizedTF = 1 + Math.log(value.rawFrequencyTF);
        value.doubleNormalizedTF = 0.5 + (0.5 * (value.rawFrequencyTF / highestTerm.rawFrequencyTF));
    }
    return freqMap;
}

function doubleNormalizedTermCompare(t1: Term, t2: Term): number {
    if (t1.doubleNormalizedTF > t2.doubleNormalizedTF) {
        return -1;
    }
    if (t1.doubleNormalizedTF < t2.doubleNormalizedTF) {
        return 1;
    }
    return 0;
}

export async function tfidf(connector: ConnectorServer, document: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    // const processed = document.replace(/[^A-Za-zА-Яа-я0-9_']+/, "");
    // console.log(processed);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    const map = buildTermFrequencyMapFromNLPDocument(result);
    const yo: Array<Term> = Array.from(map, ([key, value]) => value);
    yo.sort(doubleNormalizedTermCompare);
    for (let i = 0; i < 5; i++) {
        const value = yo[i];
        console.log(`${value.lemma}:\n
            raw: ${value.rawFrequencyTF}\n
            dl: ${value.dlNormalizedTf}\n
            log: ${value.logNormalizedTF}\n
            double: ${value.doubleNormalizedTF}]n
        `);
    }
    return undefined;
}
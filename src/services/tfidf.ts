import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import { logger } from "../utils/logger";
import { rougeN } from "../services/rouge";
import { Term, TermMap, doubleNormalizedTermCompare, rawFrequencyTermCompare, logNormalizedTermCompare, dlNormalizedTermCompare } from "../models/term";

const props = new Properties({
    annotators: "tokenize,ssplit,pos,lemma,ner,parse,relation",
});

// TF-IDuF? -> Store all user words for some 'idf' like calculation

const posFilter = ["CD", "FW", "JJ", "JJR", "JJS", "NN", "NNS", "NNP", "NNPS", "RB", "RBR", "RBS", "VB", "VBG", "VBN", "VBP", "VBZ"];
const nounFilter = ["NN", "NNS", "NNP", "NNPS"];

// TF Varieties:
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
            if (nounFilter.indexOf(token.pos()) > -1) {
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




export async function tfidf(connector: ConnectorServer, document: string): Promise<JSON> {
    const pipeline = new Pipeline(props, "English", connector);
    const sent = new CoreNLP.simple.Document(document);
    const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
    const map = buildTermFrequencyMapFromNLPDocument(result);
    const yo: Array<Term> = Array.from(map, ([key, value]) => value);
    yo.sort(doubleNormalizedTermCompare);
    const a = yo.slice(0, 5);
    yo.sort(dlNormalizedTermCompare);
    const b = yo.slice(0, 5);
    yo.sort(rawFrequencyTermCompare);
    const c = yo.slice(0, 5);
    yo.sort(logNormalizedTermCompare);
    const d = yo.slice(0, 5);
    // sort and slice on all tf versions
    let as, bs, cs, ds;
    as = bs = cs = ds = "";
    for (let i = 0; i < 5; i++) {
        as += `${a[i].lemma} `;
        bs += `${b[i].lemma} `;
        cs += `${c[i].lemma} `;
        ds += `${d[i].lemma} `;
    }
    const summary = "Elaine discusses the limitations of";
    const score1 = rougeN(as, summary);
    const score2 = rougeN(bs, summary);
    const score3 = rougeN(cs, summary);
    const score4 = rougeN(ds, summary);
    const res = `{
        "reference summary": "${summary}",
        "doubleNormalized": {
            "summary": \"${as}\",
            "rougeN": ${score1}
        },
        "dlNormalized": {
            "summary": \"${bs}\",
            "rougeN": ${score2}
        },
        "rawFrequency": {
            "summary": \"${cs}\",
            "rougeN": ${score3}
        }
        ,"logNormalized": {
            "summary": \"${ds}\",
            "rougeN": ${score4}
        }
    }`;
    return JSON.parse(res);
}
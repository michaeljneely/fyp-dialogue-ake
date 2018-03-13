import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";

export type TermMap = Map<string, Term>;

export class Term {
    public token: CoreNLP.simple.Token;
    public tf: number;
    public corpusIDF: number;
    public userIDF: number;

    constructor(token: CoreNLP.simple.Token, tf: number = 1, corpusIDF: number = 1, userIDF: number = 1) {
        this.token = token;
        this.tf = tf;
        this.corpusIDF = corpusIDF;
        this.userIDF = userIDF;
    }

}

// export function doubleNormalizedTermCompare(t1: Term, t2: Term): number {
//     if (t1.doubleNormalizedTF > t2.doubleNormalizedTF) {
//         return -1;
//     }
//     if (t1.doubleNormalizedTF < t2.doubleNormalizedTF) {
//         return 1;
//     }
//     return 0;
// }

// export function rawFrequencyTermCompare(t1: Term, t2: Term): number {
//     if (t1.rawFrequencyTF > t2.rawFrequencyTF) {
//         return -1;
//     }
//     if (t1.rawFrequencyTF < t2.rawFrequencyTF) {
//         return 1;
//     }
//     return 0;
// }

// export function logNormalizedTermCompare(t1: Term, t2: Term): number {
//     if (t1.logNormalizedTF > t2.logNormalizedTF) {
//         return -1;
//     }
//     if (t1.logNormalizedTF < t2.logNormalizedTF) {
//         return 1;
//     }
//     return 0;
// }

// export function dlNormalizedTermCompare(t1: Term, t2: Term): number {
//     if (t1.dlNormalizedTf > t2.dlNormalizedTf) {
//         return -1;
//     }
//     if (t1.dlNormalizedTf < t2.dlNormalizedTf) {
//         return 1;
//     }
//     return 0;
// }
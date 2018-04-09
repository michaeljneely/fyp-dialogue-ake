import CoreNLP from "corenlp";
import * as _ from "lodash";
import { CorpusCandidateTerm, CorpusCandidateTermModel } from "../../models/corpusCandidateTerm";
import { CorpusDocument, CorpusDocumentModel } from "../../models/CorpusDocument";
import { make2DNumberArray } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { extractCandidateTermsFromCoreNLPDocument } from "./candidateTerm";

/*
    Perform Latent Dirichlet Allocation (LDA)
        - A method of extracting topics that define a document
        - The big question is how many distinct topics does a document have?
        - Limitation: topics are limited to terms in the vocabulary

    Based off of work by: https://github.com/primaryobjects/lda/
*/

// Vocabulary interface necessary for LDA
interface Vocab {
    // Get vocabulary index by term
    candidateTermToIndex: Map<string, number>;
    // Get vocabulary term by index
    indexToCandidateTerm: Map<number, string>;
    // Each document is represented by an array of vocabulary indices
    documents: Array<Array<number>>;
}


// Build the Vocabulary interface necessary for LDA - Only consider Candidate Terms (NP chunks)
async function buildCorpusVocab(terms: Array<string>): Promise<Vocab> {
    const candidateTermToIndex = new Map<string, number>();
    const indexToCandidateTerm = new Map<number, string>();
    let index = -1;
    try {
        const corpusCandidateTerms = await CorpusCandidateTermModel.find({});
        if (corpusCandidateTerms) {
            const ccts = corpusCandidateTerms.map((cct: CorpusCandidateTerm) => cct.term);
            // Extract Corpus Lemmas
            _.uniq(ccts).forEach((cct: string) => {
                index++;
                indexToCandidateTerm.set(index, cct);
                candidateTermToIndex.set(cct, index);
            });
            // Merge in unique lemmas from Document
            terms.forEach((term: string) => {
                if ( ! candidateTermToIndex.has(term)) {
                    index++;
                    candidateTermToIndex.set(term, index);
                    indexToCandidateTerm.set(index, term);
                }
            });
            // Generate document vectors
            const documents = await CorpusDocumentModel.find({});
            const docs = new Array<Array<number>>();
            documents.forEach((document: CorpusDocument) => {
                const docVector = new Array<number>();
                const dcts = extractCandidateTermsFromCoreNLPDocument(CoreNLP.simple.Document.fromJSON(document.processedText)).toStringArray();
                dcts.forEach((dct: string) => {
                    if (candidateTermToIndex.get(dct) !== undefined ) {
                        docVector.push(candidateTermToIndex.get(dct));
                    }
                });
                docs.push(docVector);
            });
            return Promise.resolve({
                candidateTermToIndex,
                indexToCandidateTerm,
                documents: docs
            });
        }
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

export async function topicise(cts: Array<string>, K: number): Promise<Array<Array<string>>> {
    try {
        const V = await buildCorpusVocab(cts);
        const documents = V.documents;
        const lda = new LdaGibbsSampler(documents, V.candidateTermToIndex.size);
        // good values alpha = 2, beta = .5
        const alpha = 2;
        const beta = .5;
        lda.gibbs(K, alpha, beta);
        // Theta appears okay
        const theta = lda.getTheta();
        const phi = lda.getPhi();
        // topics
        const topTerms = 10;
        const topics = new Array<Array<string>>();
        for (let k = 0; k < phi.length; k++) {
            const tuples = new Array<[number, string]>(k);
            const a = new Array<string>(k);
            for (let w = 0; w < phi[k].length; w++) {
                tuples.push([phi[k][w], V.indexToCandidateTerm.get(w - 1)]);
            }
            tuples.sort((a, b) => {
                if (a[0] > b[0]) {
                    return -1;
                }
                else if (a[0] < b[0]) {
                    return 1;
                }
                else return 0;
            });
            const topTerms = (V.candidateTermToIndex.size < 10) ? V.candidateTermToIndex.size : 10;
            topics.push(tuples.slice(0, topTerms - 1).map(([prob, term]) => term));
        }
        return Promise.resolve(topics);
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

export class LdaGibbsSampler {

    /**
     * sampling lag
     */
    private THIN_INTERVAL: number;

    /**
     * burn-in period
     */
    private BURN_INTERVAL: number;

    /**
     * max iterations
     */
    private ITERATIONS: number;

    /**
     * sample lag (if -1 only one sample taken)
     */
    private SAMPLE_LAG: number;

    /**
     * document data (term lists)
     */
    private documents: Array<Array<number>>;

    /**
     * vocabulary size
     */
    private V: number;

    /**
     * number of topics
     */
    private K: number;

    /**
     * Dirichlet parameter (document--topic associations)
     */
    private alpha: number;

    /**
     * Dirichlet parameter (topic--term associations)
     */
    private beta: number;

    /**
     * topic assignments for each word.
     */
    private z: Array<Array<number>>;

    /**
     * cwt[i][j] number of instances of word i (term?) assigned to topic j.
     */
    private nw: Array<Array<number>>;

    /**
     * na[i][j] number of words in document i assigned to topic j.
     */
    private nd: Array<Array<number>>;

    /**
     * nwsum[j] total number of words assigned to topic j.
     */
    private nwsum: Array<number>;

    /**
     * nasum[i] total number of words in document i.
     */
    private ndsum: Array<number>;

    /**
     * cumulative statistics of theta
     */
    private thetasum: Array<Array<number>>;

    /**
     * cumulative statistics of phi
     */
    private phisum: Array<Array<number>>;

    /**
     * size of statistics
     */
    private numstats: number;

    /**
     * Initialize the Gibbs sampler with data.
     *
     * @param V - vocabulary size
     * @param data
     */
    constructor(documents: Array<Array<number>>, V: number, iterations: number = 1000, burnInterval: number = 100, thinInterval: number = 20, sampleLag: number = 100) {
        this.documents = documents;
        this.V = V;
        this.ITERATIONS = iterations;
        this.BURN_INTERVAL = burnInterval;
        this.THIN_INTERVAL = thinInterval;
        this.SAMPLE_LAG = sampleLag;
        this.z = new Array<Array<number>>();
        this.nd = new Array<Array<number>>();
        this.nw = new Array<Array<number>>();
        this.phisum = new Array<Array<number>>();
        this.thetasum = new Array<Array<number>>();
        this.nwsum = new Array<number>();
        this.ndsum = new Array<number>();
        this.alpha = 0.0;
        this.beta = 0.0;
    }

    public initialState(K: number): void {
        const M = this.documents.length;
        this.nw = make2DNumberArray(this.V, K);
        this.nd = make2DNumberArray(M, K);
        this.nwsum = new Array<number>(K).fill(0);
        this.ndsum = new Array<number>(M).fill(0);
        this.z = make2DNumberArray(M, M);
        for (let m = 0; m < M; m++) {
            const N = this.documents[m].length;
            for (let n = 0; n < N; n++) {
                const topic = parseInt("" + (Math.random() * K));
                this.z[m][n] = topic;
                this.nw[this.documents[m][n]][topic]++;
                this.nd[m][topic]++;
                this.nwsum[topic]++;
            }
            this.ndsum[m] = N;
        }
    }

    public gibbs(K: number, alpha: number, beta: number): void {
        this.K = K;
        this.alpha = alpha;
        this.beta = beta;
        if (this.SAMPLE_LAG > 0) {
            this.thetasum = make2DNumberArray(this.documents.length, this.K);
            this.phisum = make2DNumberArray(this.K, this.V);
            this.numstats = 0;
        }
        this.initialState(K);
        for (let i = 0; i < this.ITERATIONS; i++) {
            for (let m = 0; m < this.z.length; m++) {
                for (let n = 0; n < this.z[m].length; n++) {
                    const topic = this.sampleFullConditional(m, n);
                    this.z[m][n] = topic;
                }
            }
            if ((i > this.BURN_INTERVAL) && (this.SAMPLE_LAG > 0) && (i % this.SAMPLE_LAG == 0)) {
                this.updateParams();
            }
        }
    }

    private sampleFullConditional(m: number, n: number): number {
        let topic = this.z[m][n];
        this.nw[this.documents[m][n]][topic]--;
        this.nd[m][topic]--;
        this.nwsum[topic]--;
        this.ndsum[m]--;
        const p = new Array<number>(this.K);
        for (let k = 0; k < this.K; k++) {
            p[k] = (this.nw[this.documents[m][n]][k] + this.beta) / (this.nwsum[k] + this.V * this.beta)
                * (this.nd[m][k] + this.alpha) / (this.ndsum[m] + this.K * this.alpha);
        }
        for (let k = 1; k < p.length; k++) {
            p[k] += p[k - 1];
        }
        const u = Math.random() * p[this.K - 1];
        for (topic = 0; topic < p.length; topic++) {
            if (u < p[topic])
                break;
        }
        this.nw[this.documents[m][n]][topic]++;
        this.nd[m][topic]++;
        this.nwsum[topic]++;
        this.ndsum[m]++;
        return topic;
    }

    private updateParams(): void {
        for (let m = 0; m < this.documents.length; m++) {
            for (let k = 0; k < this.K; k++) {
                this.thetasum[m][k] += (this.nd[m][k] + this.alpha) / (this.ndsum[m] + this.K * this.alpha);
            }
        }
        for (let k = 0; k < this.K; k++) {
            for (let w = 0; w < this.V; w++) {
                this.phisum[k][w] += (this.nw[w][k] + this.beta) / (this.nwsum[k] + this.V * this.beta);
            }
        }
        this.numstats++;
    }

    public getTheta(): Array<Array<number>> {
        const theta = make2DNumberArray(this.documents.length, this.K);
        if (this.SAMPLE_LAG > 0) {
            for (let m = 0; m < this.documents.length; m++) {
                for (let k = 0; k < this.K; k++) {
                    theta[m][k] = this.thetasum[m][k] / this.numstats;
                }
            }
        } else {
            for (let m = 0; m < this.documents.length; m++) {
                for (let k = 0; k < this.K; k++) {
                    theta[m][k] = (this.nd[m][k] + this.alpha) / (this.ndsum[m] + this.K * this.alpha);
                }
            }
        }
        return theta;
    }

    public getPhi(): Array<Array<number>> {
        const phi = make2DNumberArray(this.K, this.V);
        if (this.SAMPLE_LAG > 0) {
            for (let k = 0; k < this.K; k++) {
                for (let w = 0; w < this.V; w++) {
                    phi[k][w] = this.phisum[k][w] / this.numstats;
                }
            }
        } else {
            for (let k = 0; k < this.K; k++) {
                for (let w = 0; w < this.V; w++) {
                    phi[k][w] = (this.nw[w][k] + this.beta) / (this.nwsum[k] + this.V * this.beta);
                }
            }
        }
        return phi;
    }

}

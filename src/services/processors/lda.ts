import CoreNLP from "corenlp";
import * as _ from "lodash";
import { CandidateTerm, CorpusCandidateTerm, CorpusCandidateTermModel } from "../../models/CandidateTerm";
import { CorpusDocument, CorpusDocumentModel } from "../../models/Document";
import { make2DNumberArray } from "../../utils/functions";
import { logger } from "../../utils/logger";
import { extractCandidateTermsFromCoreNLPDocument } from "./candidateTerm";

/*
    Perform Latent Dirichlet Allocation (LDA)
        - A method of extracting topics that define a document
        - The big question is how many distinct topics does a document have?
        - Limitation: topics are limited to terms in the vocabulary
        - Random seed determined by Math.random()
    Refer to https://en.wikipedia.org/wiki/Latent_Dirichlet_allocation for more information
    Based off of work by: https://github.com/primaryobjects/lda/ & http://www.arbylon.net/projects/LdaGibbsSampler.java
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
function buildCorpusVocab(conversationCandidateTerms: Array<string>): Vocab {
    const candidateTermToIndex = new Map<string, number>();
    const indexToCandidateTerm = new Map<number, string>();
    let index = -1;
    const docs = new Array<Array<number>>();
    const doc = new Array<number>();
    conversationCandidateTerms.forEach((term: string) => {
        if (!candidateTermToIndex.has(term)) {
            index++;
            candidateTermToIndex.set(term, index);
            indexToCandidateTerm.set(index, term);
            doc.push(index);
        }
    });
    docs.push(doc);
    return {
        candidateTermToIndex,
        indexToCandidateTerm,
        documents: docs
    };
}

export function topicise(conversationCandidateTerms: Array<string>, numTopics: number, numTermsPerTopic: number = process.env.LDA_TERMS_PER_TOPIC, alpha: number = process.env.LDA_ALPHA, beta: number = process.env.LDA_BETA): Array<Array<[string, number]>> {
    logger.info(`Performing LDA for ${numTopics} with ${numTermsPerTopic} terms per topic and an alpha of ${alpha} and a beta of ${beta}`);
    // Get vocabulary
    const vocabulary = buildCorpusVocab(conversationCandidateTerms);
    // Create a Gibbs Sampler
    const documents = vocabulary.documents;
    const gibbs = new LdaGibbsSampler(documents, vocabulary.candidateTermToIndex.size);
    // Sample
    gibbs.run(numTopics, alpha, beta);
    // Get Phi and Theta statistics
    const theta = gibbs.getTheta();
    const phi = gibbs.getPhi();
    // Return best terms per topic
    const topics = new Array<Array<[string, number]>>();
    for (let k = 0; k < phi.length; k++) {
        const tuples = new Array<[string, number]>(k);
        const a = new Array<string>(k);
        for (let w = 0; w < phi[k].length; w++) {
            tuples.push([vocabulary.indexToCandidateTerm.get(w - 1), phi[k][w]]);
        }
        // Sort on Probabilities
        tuples.sort((a, b) => {
            if (a[1] > b[1]) {
                return -1;
            }
            else if (a[1] < b[1]) {
                return 1;
            }
            else return 0;
        });
        const topTerms = (vocabulary.candidateTermToIndex.size < numTermsPerTopic) ? vocabulary.candidateTermToIndex.size : numTermsPerTopic;
        topics.push(tuples.slice(0, numTermsPerTopic));
    }
    return topics;
}

/*---------------------------------------------------*/
/*
    Gibbs Sampling Implementation Class
    See - https://en.wikipedia.org/wiki/Gibbs_sampling
*/
export class LdaGibbsSampler {

    /**
     * Burn-in period (number of iterations to run before parameters are updated)
     */
    private BURN_INTERVAL: number;

    /**
     * Max iterations
     */
    private ITERATIONS: number;

    /**
     * Sample lag (if -1 only one sample taken)
     */
    private SAMPLE_LAG: number;

    /**
     * Document data (term lists)
     */
    private documents: Array<Array<number>>;

    /**
     * Vocabulary size
     */
    private V: number;

    /**
     * Number of topics
     */
    private K: number;

    /**
     * Dirichlet parameter (document/topic associations)
     */
    private alpha: number;

    /**
     * Dirichlet parameter (topic/term associations)
     */
    private beta: number;

    /**
     * Topic assignments for each word.
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
     * nwSum[j] total number of words assigned to topic j.
     */
    private nwSum: Array<number>;

    /**
     * naSum[i] total number of words in document i.
     */
    private ndSum: Array<number>;

    /**
     * cumulative statistics of theta
     */
    private thetaSum: Array<Array<number>>;

    /**
     * cumulative statistics of phi
     */
    private phiSum: Array<Array<number>>;

    /**
     * size of statistics
     */
    private numStats: number;

    /**
     * Initialize the Gibbs sampler with data.
     *
     * @param {number} V - vocabulary size
     * @param {number} iterations Maximum sampling iterations to run
     * @param {number} burnInterval Burn in Period. Generally, early sample are not accurate and therefore discarded.
     * @param {number} sampleLag Updating parameters too fast leads to a slow convergence
     */
    constructor(documents: Array<Array<number>>, V: number, iterations: number = 1000, burnInterval: number = 100, sampleLag: number = 100) {
        this.documents = documents;
        this.V = V;
        this.ITERATIONS = iterations;
        this.BURN_INTERVAL = burnInterval;
        this.SAMPLE_LAG = sampleLag;
        this.z = new Array<Array<number>>();
        this.nd = new Array<Array<number>>();
        this.nw = new Array<Array<number>>();
        this.phiSum = new Array<Array<number>>();
        this.thetaSum = new Array<Array<number>>();
        this.nwSum = new Array<number>();
        this.ndSum = new Array<number>();
        this.alpha = 0.0;
        this.beta = 0.0;
    }

    /**
     * Random(ish) assignments of terms to topics with equal probabilities
     * Initialize state of Markov Chain
     * @param {number} K - number of topics
     */
    private initialState(K: number): void {
        const M = this.documents.length;
        this.nw = make2DNumberArray(this.V, K);
        this.nd = make2DNumberArray(M, K);
        this.nwSum = new Array<number>(K).fill(0);
        this.ndSum = new Array<number>(M).fill(0);
        this.z = make2DNumberArray(M, M);
        for (let m = 0; m < M; m++) {
            const N = this.documents[m].length;
            for (let n = 0; n < N; n++) {
                const topic = parseInt("" + (Math.random() * K));
                this.z[m][n] = topic;
                this.nw[this.documents[m][n]][topic]++;
                this.nd[m][topic]++;
                this.nwSum[topic]++;
            }
            this.ndSum[m] = N;
        }
    }

    /**
     * Run the Gibbs Sampling
     *      - Build initial state
     *      - Repeat for N iterations:
     *          - Sample full conditional on topic
     *          - Adjust parameters according to lag and burn interval
     * @param K - Number of topics
     * @param alpha - LDA alpha parameter
     * @param beta - LDA beta parameter
     */
    public run(K: number, alpha: number, beta: number): void {
        this.K = K;
        this.alpha = alpha;
        this.beta = beta;
        if (this.SAMPLE_LAG > 0) {
            this.thetaSum = make2DNumberArray(this.documents.length, this.K);
            this.phiSum = make2DNumberArray(this.K, this.V);
            this.numStats = 0;
        }
        this.initialState(K);
        for (let i = 0; i < this.ITERATIONS; i++) {
            for (let m = 0; m < this.z.length; m++) {
                for (let n = 0; n < this.z[m].length; n++) {
                    const topic = this.sampleFullConditional(m, n);
                    this.z[m][n] = topic;
                }
            }
            // Updates are only performed after the burn-in interval, and are limited by the sample lag
            if ((i > this.BURN_INTERVAL) && (this.SAMPLE_LAG > 0) && (i % this.SAMPLE_LAG == 0)) {
                this.updateParams();
            }
        }
    }

    /**
     * Select a topic from the Markov Chain
     * @param {number} m Document
     * @param {number} n Word
     */
    private sampleFullConditional(m: number, n: number): number {
        let topic = this.z[m][n];
        this.nw[this.documents[m][n]][topic]--;
        this.nd[m][topic]--;
        this.nwSum[topic]--;
        this.ndSum[m]--;
        const p = new Array<number>(this.K);
        for (let k = 0; k < this.K; k++) {
            p[k] = (this.nw[this.documents[m][n]][k] + this.beta) / (this.nwSum[k] + this.V * this.beta)
                * (this.nd[m][k] + this.alpha) / (this.ndSum[m] + this.K * this.alpha);
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
        this.nwSum[topic]++;
        this.ndSum[m]++;
        return topic;
    }

    /**
     * Adjust totals as per current phi and theta values
     */
    private updateParams(): void {
        for (let m = 0; m < this.documents.length; m++) {
            for (let k = 0; k < this.K; k++) {
                this.thetaSum[m][k] += (this.nd[m][k] + this.alpha) / (this.ndSum[m] + this.K * this.alpha);
            }
        }
        for (let k = 0; k < this.K; k++) {
            for (let w = 0; w < this.V; w++) {
                this.phiSum[k][w] += (this.nw[w][k] + this.beta) / (this.nwSum[k] + this.V * this.beta);
            }
        }
        this.numStats++;
    }

    /**
     * Get estimated document/topic associations.
     */
    public getTheta(): Array<Array<number>> {
        const theta = make2DNumberArray(this.documents.length, this.K);
        if (this.SAMPLE_LAG > 0) {
            for (let m = 0; m < this.documents.length; m++) {
                for (let k = 0; k < this.K; k++) {
                    theta[m][k] = this.thetaSum[m][k] / this.numStats;
                }
            }
        } else {
            for (let m = 0; m < this.documents.length; m++) {
                for (let k = 0; k < this.K; k++) {
                    theta[m][k] = (this.nd[m][k] + this.alpha) / (this.ndSum[m] + this.K * this.alpha);
                }
            }
        }
        return theta;
    }

    /**
     * Get estimated topic/term associations.
     */
    public getPhi(): Array<Array<number>> {
        const phi = make2DNumberArray(this.K, this.V);
        if (this.SAMPLE_LAG > 0) {
            for (let k = 0; k < this.K; k++) {
                for (let w = 0; w < this.V; w++) {
                    phi[k][w] = this.phiSum[k][w] / this.numStats;
                }
            }
        } else {
            for (let k = 0; k < this.K; k++) {
                for (let w = 0; w < this.V; w++) {
                    phi[k][w] = (this.nw[w][k] + this.beta) / (this.nwSum[k] + this.V * this.beta);
                }
            }
        }
        return phi;
    }

}

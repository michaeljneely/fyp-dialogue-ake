import { make2DNumberArray } from "../utils/functions";
import { CorpusLemma, CorpusLemmaModel } from "../models/CorpusLemma";
import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { logger } from "../utils/logger";
import * as _ from "lodash";

interface Vocab {
    lemmaToIndex: Map<string, number>;
    indexToLemma: Map<number, string>;

    documents: Array<Array<number>>;
}

// Build lemma -> index and index -> lemma map
async function buildVocab(documentLemmas: Array<string>): Promise<Vocab> {
    const a = new Map<number, string>();
    const b = new Map<string, number>();
    let index = -1;
    return CorpusLemmaModel.find({}).exec()
        // Extract Corpus Lemmas
        .then((lemmas: Array<CorpusLemma>) => {
            logger.info(lemmas.length.toString());
            const yo = lemmas.map((lemma: CorpusLemma) => lemma.lemma);
            logger.info(_.uniq(yo).length.toString());
            lemmas.forEach((corpusLemma: CorpusLemma) => {
                index++;
                if (b.has(corpusLemma.lemma)) {
                    logger.info("dup!: " + corpusLemma.lemma);
                }
                a.set(index, corpusLemma.lemma);
                b.set(corpusLemma.lemma, index);
            });
            // Merge in unique lemmas from Document
            documentLemmas.forEach((lemma: string) => {
                if ( ! b.has(lemma)) {
                    index++;
                    b.set(lemma, index);
                    a.set(index, lemma);
                }
            });

            return CorpusDocumentModel.find({}).exec();
        })
        .then((documents: Array<CorpusDocument>) => {
            const docs = new Array<Array<number>>();
            documents.forEach((document: CorpusDocument) => {
                const docVector = new Array<number>();
                document.text.split(" ").forEach((lemma: string) => {
                    if (lemma) {
                        docVector.push(b.get(lemma));
                    }
                });
                docs.push(docVector);
            });
            return docs;
        })
        .then((documents: Array<Array<number>>) => {
            return Promise.resolve({
                lemmaToIndex: b,
                indexToLemma: a,
                documents
            });
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}

export async function topicise(documentLemmas: Array<string>, K: number): Promise<void> {
    const V = await buildVocab(documentLemmas);
    const documents = V.documents;
    const lda = new LdaGibbsSampler(documents, V.lemmaToIndex.size);
    // good values alpha = 2, beta = .5
    const alpha = 2;
    const beta = .5;
    lda.gibbs(K, alpha, beta);
    const theta = lda.getTheta();
    const phi = lda.getPhi();
    const text = "";
    // topics
    let topTerms = 20;
    const topicText = new Array();
    for (let k = 0; k < phi.length; k++) {
        const tuples = new Array<string>();
        for (let w = 0; w < phi[k].length; w++) {
             tuples.push("" + phi[k][w].toPrecision(2) + "_" + V.indexToLemma.get(w));
        }
        tuples.sort().reverse();
        if (topTerms > V.indexToLemma.size) topTerms = V.indexToLemma.size;
        topicText[k] = "";
        for (let t = 0; t < topTerms; t++) {
            const topicTerm = tuples[t].split("_")[1];
            const prob = parseInt(tuples[t].split("_")[0]) * 100;
            if (prob < 0.0001) continue;
            topicText[k] += ( topicTerm + " ");
        }
    }
    topicText.forEach((topic, index) => {
        logger.info(index + ": " + topic);
    });
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
        this.nwsum = new Array<number>(K);
        this.ndsum = new Array<number>(M);
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
        const theta = make2DNumberArray(this.documents.length, this.documents.length);
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
        const phi = make2DNumberArray(this.K, this.K);
        for (let i = 0; i < this.K; i++) phi[i] = new Array();
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
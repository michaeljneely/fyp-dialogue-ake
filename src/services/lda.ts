import { make2DNumberArray } from "../utils/functions";


function buildVocab(): Map<number, string> {
    // read in all lemmas from corpus
    // assign to lemma -> index map
    // assign to index -> lemma map
    // assign index to document
    return new Map<number, string>();
}

function topicise(K: number): void {
    const documents = new Array<Array<number>>();
    const V = buildVocab().size;
    const lda = new LdaGibbsSampler(documents, V);
    // good values alpha = 2, beta = .5
    const alpha = 2;
    const beta = .5;
    this.lda.gibbs(K, alpha, beta);
    const theta = this.lda.getTheta();
    const phi = this.lda.getPhi();
    const map = buildVocab();
    const text = "";
    // topics
    let topTerms = 20;
    const topicText = new Array();
    for (let k = 0; k < phi.length; k++) {
        const tuples = new Array<string>();
        for (let w = 0; w < phi[k].length; w++) {
             tuples.push("" + phi[k][w].toPrecision(2) + "_" + map.get(w));
        }
        tuples.sort().reverse();
        if (topTerms > map.size) topTerms = map.size;
        topicText[k] = "";
        for (let t = 0; t < topTerms; t++) {
            const topicTerm = tuples[t].split("_")[1];
            const prob = parseInt(tuples[t].split("_")[0]) * 100;
            if (prob < 0.0001) continue;
            topicText[k] += ( topicTerm + " ");
        }
        console.log(topicText);
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
        this.z = make2DNumberArray(M, K);
        for (let m = 0; m < M; m++) {
            const N = this.documents[m].length;
            this.z[m] = new Array<number>();
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

    public getTheta(): Array<number> {
        const theta = new Array();
        for (let i = 0; i < this.documents.length; i++) theta[i] = new Array();
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

    public getPhi(): Array<number> {
        const phi = new Array();
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
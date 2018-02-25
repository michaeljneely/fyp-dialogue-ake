export type TermMap = Map<string, Term>;

export type Term = {
    token: token;
    rawFrequencyTF: number;
    dlNormalizedTf: number;
    logNormalizedTF: number;
    doubleNormalizedTF: number;
};

export function doubleNormalizedTermCompare(t1: Term, t2: Term): number {
    if (t1.doubleNormalizedTF > t2.doubleNormalizedTF) {
        return -1;
    }
    if (t1.doubleNormalizedTF < t2.doubleNormalizedTF) {
        return 1;
    }
    return 0;
}

export function rawFrequencyTermCompare(t1: Term, t2: Term): number {
    if (t1.rawFrequencyTF > t2.rawFrequencyTF) {
        return -1;
    }
    if (t1.rawFrequencyTF < t2.rawFrequencyTF) {
        return 1;
    }
    return 0;
}

export function logNormalizedTermCompare(t1: Term, t2: Term): number {
    if (t1.logNormalizedTF > t2.logNormalizedTF) {
        return -1;
    }
    if (t1.logNormalizedTF < t2.logNormalizedTF) {
        return 1;
    }
    return 0;
}

export function dlNormalizedTermCompare(t1: Term, t2: Term): number {
    if (t1.dlNormalizedTf > t2.dlNormalizedTf) {
        return -1;
    }
    if (t1.dlNormalizedTf < t2.dlNormalizedTf) {
        return 1;
    }
    return 0;
}
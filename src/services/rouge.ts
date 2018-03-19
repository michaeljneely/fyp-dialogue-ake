import { n, l, s } from "rouge";

// Implement Rouge Metrics

export function rougeN(candidate: string, reference: string) {
    return n(candidate, reference, undefined);
}

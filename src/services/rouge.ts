import { n, l, s } from "rouge";

export function rougeN(candidate: string, reference: string) {
    return n(candidate, reference, undefined);
}
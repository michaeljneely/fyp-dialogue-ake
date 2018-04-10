const levenshtein = require("js-levenshtein");

export function levenshteinDistance(str1: string, str2: string): number {
    return levenshtein(str1, str2);
}

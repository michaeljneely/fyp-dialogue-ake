import { nGrams, rougeN } from "../src/services/metrics/rouge";

describe("TEST Metrics Service", () => {

    it("Should extract all bigrams", () => {
        const test = ["hello", "there", "sir"];
        const bigrams = nGrams(test, 2);
        expect(bigrams.length).toBe(2);
        expect(bigrams).toContainEqual(["hello", "there"]);
        expect(bigrams).toContainEqual(["there", "sir"]);
    });

    it("Should correctly calculate Rouge-2", () => {
        // 5 n-grams total in candidate, 4 matching in reference -> 4/5 = 0.8
        const candidate = ["the", "cat", "was", "under", "the", "bed"];
        const reference = ["the", "cat", "was", "found", "under", "the", "bed"];
        expect(rougeN(candidate, reference, 2)).toBe(0.8);
    });

});

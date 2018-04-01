import CoreNLP, { ConnectorServer } from "corenlp";
import * as request from "supertest";
import * as app from "../src/app";
import * as corenlpService from "../src/services/corenlp";
import * as semClusterService from "../src/services/semcluster";
import { Stack } from "../src/utils/stack";

const cteText = "Cat. Cats. Americas. George Washington. John in the hat. This is minty gum. John of Smith. John Smith of. John Smith West. John of Smith West. Dog bird dog. This is minty not gum. James of minty. gold medal the. the. running. spicy gum. fresh gum stick. Michael. Michael running.";
const testString = "This is a sentence";

describe("TEST SemCluster Service", () => {

    beforeEach(function() {
        // Long for CI builds
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });

    it("Should correctly build a string from a Token Stack", async () => {
        expect.assertions(1);
        const connector = new ConnectorServer({ dsn: process.env.CoreNLP_ADDRESS });
        const tokenStack = new Stack<CoreNLP.simple.Token>();
        const result = await corenlpService.parseDocument(testString, false, connector);
        const document = result.document;
        for (const sentence of document.sentences()) {
            sentence.tokens().forEach((token) => {
            tokenStack.push(token);
            });
        }
        expect(semClusterService.buildStringFromTokenStack(tokenStack)).toEqual(testString);
    });

    it("Should correctly identify all unique candidate terms", async () => {
        expect.assertions(19);
        const connector = new ConnectorServer({ dsn: process.env.CoreNLP_ADDRESS });
        const result = await corenlpService.parseDocument(cteText, false, connector);
        const candidateTerms = semClusterService.extractCandidateTerms(result.document);
        expect(candidateTerms.length).toEqual(18);
        expect(candidateTerms).toContain("Cat");
        expect(candidateTerms).toContain("Cats");
        expect(candidateTerms).toContain("Americas");
        expect(candidateTerms).toContain("George Washington");
        expect(candidateTerms).toContain("John");
        expect(candidateTerms).toContain("hat");
        expect(candidateTerms).toContain("minty gum");
        expect(candidateTerms).toContain("John of Smith");
        expect(candidateTerms).toContain("John Smith");
        expect(candidateTerms).toContain("John Smith West");
        expect(candidateTerms).toContain("John of Smith West");
        expect(candidateTerms).toContain("Dog bird dog");
        expect(candidateTerms).toContain("gum");
        expect(candidateTerms).toContain("James");
        expect(candidateTerms).toContain("gold medal");
        expect(candidateTerms).toContain("spicy gum");
        expect(candidateTerms).toContain("fresh gum stick");
        expect(candidateTerms).toContain("Michael");
    });
});

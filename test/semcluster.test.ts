import CoreNLP, { ConnectorServer } from "corenlp";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import * as request from "supertest";
import * as app from "../src/app";
import * as corenlpService from "../src/services/corenlp";
import * as semClusterService from "../src/services/semcluster";
import { Stack } from "../src/utils/stack";

describe("TEST SemCluster Service", () => {

    // Simple sentence to test string building from stack
    const testString = "This is a sentence";
    // Complex document to test every branch of the candidate term extraction function
    const cteText = "Cat. Cats. Americas. George Washington. John in the hat. This is minty gum. John of Smith. John Smith of. John Smith West. John of Smith West. Dog bird dog. This is minty not gum. James of minty. gold medal the. the. running. spicy gum. fresh gum stick. Michael. Michael running.";
    // Stubbing CoreNLP Server saves a substantial amount of time
    const coreNLPStub = sinon.stub(corenlpService, "parseDocument");

    afterEach(() => {
        coreNLPStub.reset();
    });

    it("Should correctly build a string from a Token Stack", async () => {
        expect.assertions(1);
        // Stub parseDocument
        const simpleSentence = await fs.readJSON(path.join(__dirname, "mocks/simple.json"));
        const simpleDocument = CoreNLP.simple.Document.fromJSON(simpleSentence);
        coreNLPStub.returns({
            document: simpleDocument,
            speakers: new Array<string>()
        });
        const result = await corenlpService.parseDocument(testString, false);
        const document = result.document;
        // Build token stack
        const tokenStack = new Stack<CoreNLP.simple.Token>();
        for (const sentence of document.sentences()) {
            sentence.tokens().forEach((token) => {
                tokenStack.push(token);
            });
        }
        // Verify behavior
        expect(semClusterService.buildStringFromTokenStack(tokenStack)).toEqual(testString);
        coreNLPStub.reset();
    });

    it("Should correctly identify all unique candidate terms", async () => {
        expect.assertions(19);
        // Stub parseDocument
        const complexSentences = await fs.readJSON(path.join(__dirname, "mocks/complex.json"));
        const complexDocument = CoreNLP.simple.Document.fromJSON(complexSentences);
        coreNLPStub.returns({
            document: complexDocument,
            speakers: new Array<string>()
        });
        const result = await corenlpService.parseDocument(cteText, false);
        // Extract candidate terms and verify
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
        coreNLPStub.reset();
    });
});

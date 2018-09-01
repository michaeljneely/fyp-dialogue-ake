import CoreNLP from "corenlp";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import * as request from "supertest";
import * as app from "../src/app";
import { CandidateTermTypes, ExtractedCandidateTerm } from "../src/models/CandidateTerm";
import * as corenlpService from "../src/services/corenlp/corenlp";
import * as candidateTermService from "../src/services/processors/candidateTerm";
import { Stack } from "../src/utils/stack";

describe("TEST SemCluster Service", () => {

    // Simple sentence to test string building from stack
    const testString = "This is a sentence";
    // Complex document to test every branch of the candidate term extraction function
    const cteText = "Cat. Cats. Americas. George Washington. John in the hat. This is minty gum. John of Smith. John Smith of. John Smith West. John of Smith West. Dog bird dog. This is minty not gum. James of minty. gold medal the. the. running. spicy gum. fresh gum stick. Michael. Michael running.";
    // Stubbing CoreNLP Server saves a substantial amount of time
    const coreNLPStub = sinon.stub(corenlpService, "annotate");

    afterEach(() => {
        coreNLPStub.reset();
    });

    it("Should correctly build a string from a Token Stack", async () => {
        expect.assertions(1);
        // Stub parseDocument
        const simpleSentence = await fs.readJSON(path.join(__dirname, "mocks/simple.json"));
        const simpleDocument = CoreNLP.simple.Document.fromJSON(simpleSentence);
        coreNLPStub.returns(simpleDocument);
        const document = await corenlpService.annotate(testString);
        // Build token stack
        const tokenStack = new Stack<CoreNLP.simple.Token>();
        for (const sentence of document.sentences()) {
            sentence.tokens().forEach((token) => {
                tokenStack.push(token);
            });
        }
        // Verify behavior
        expect(candidateTermService.buildStringFromTokenStack(tokenStack)).toEqual(testString.toLowerCase());
        coreNLPStub.reset();
    });

    it("Should correctly identify all unique candidate terms", async () => {
        expect.assertions(19);
        // Stub parseDocument
        const complexSentences = await fs.readJSON(path.join(__dirname, "mocks/complex.json"));
        const complexDocument = CoreNLP.simple.Document.fromJSON(complexSentences);
        coreNLPStub.returns(complexDocument);
        const document = await corenlpService.annotate(cteText);
        // Extract candidate terms and verify
        const candidateTerms = candidateTermService.extractCandidateTermsFromCoreNLPDocument(document).toStringArray();
        expect(candidateTerms.size()).toBe(18);
        expect(candidateTerms).toContain("cat");
        expect(candidateTerms).toContain("cats");
        expect(candidateTerms).toContain("americas");
        expect(candidateTerms).toContain("george washington");
        expect(candidateTerms).toContain("john");
        expect(candidateTerms).toContain("hat");
        expect(candidateTerms).toContain("minty gum");
        expect(candidateTerms).toContain("john of smith");
        expect(candidateTerms).toContain("john smith");
        expect(candidateTerms).toContain("john smith west");
        expect(candidateTerms).toContain("john of smith west");
        expect(candidateTerms).toContain("dog bird dog");
        expect(candidateTerms).toContain("gum");
        expect(candidateTerms).toContain("james");
        expect(candidateTerms).toContain("gold medal");
        expect(candidateTerms).toContain("spicy gum");
        expect(candidateTerms).toContain("fresh gum stick");
        expect(candidateTerms).toContain("michael");
        coreNLPStub.reset();
    });
});

import CoreNLP from "corenlp";
import _ = require("lodash");
import { CandidateTerm } from "../../models/CandidateTerm";
import { ISummary } from "../../models/Summary";
import { logger } from "../../utils/logger";
import { topicise } from "../processors/lda";

export function LDASummary(annotated: CoreNLP.simple.Document, candidateTermMap: Map<string, number>, numberOfTopics: number, numberOfWordsPerTopic: number): ISummary {
    logger.info(`LDASummary called()...`);
    const ldaTopics = topicise([...candidateTermMap.keys()].map((val) => CandidateTerm.fromString(val).term), numberOfTopics, numberOfWordsPerTopic);
    const summary = ldaTopics.map((topic) => {
        return topic[0]["0"];
    });
    return {
        method: "Candidate Term LDA",
        summary,
        candidateTerms: candidateTermMap
    };
}

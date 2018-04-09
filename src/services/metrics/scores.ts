import { SummaryMetric } from "../../models/Summary";
import { precision } from "./precision";
import { recall } from "./recall";
import { rougeN } from "./rouge";

export function calculateAllScores(candidate: Array<string>, reference: Array<string>, significantDigits: number = 2): Array<SummaryMetric> {
    return [
        {
            method: "Precision",
            score: precision(candidate, reference).toPrecision(significantDigits)
        },
        {
            method: "Recall",
            score: recall(candidate, reference).toPrecision(significantDigits)
        },
        {
            method: "Rouge-1",
            score: rougeN(candidate, reference, 1).toPrecision(significantDigits)
        },
        {
            method: "Rouge-2",
            score: rougeN(candidate, reference, 2).toPrecision(significantDigits)
        }
    ];
}

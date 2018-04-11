import { MetricTypes } from "../../models/Metrics";
import { SummaryMetric } from "../../models/Summary";
import { precision } from "./precision";
import { recall } from "./recall";
import { rougeN } from "./rouge";

export function calculateAllScores(candidate: string, reference: string, metrics: Array<MetricTypes>): Array<SummaryMetric> {
    return new Array<SummaryMetric>();
}

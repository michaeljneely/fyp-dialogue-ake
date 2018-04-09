import * as _ from "lodash";
import { normalizeStringArray } from "../../utils/functions";

export function precision(candidate: Array<string>, reference: Array<string>): number {
    const intersection = _.intersection(normalizeStringArray(candidate), normalizeStringArray(reference));
    return intersection.length / candidate.length;
}

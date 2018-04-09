import * as _ from "lodash";
import { normalizeStringArray } from "../../utils/functions";

export function recall(candidate: Array<string>, reference: Array<string>): number {
    const intersection = _.intersection(normalizeStringArray(candidate), normalizeStringArray(reference));
    return intersection.length / reference.length;
}

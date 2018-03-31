import * as got from "got";
import * as convert from "xml-js";
import { logger } from "../utils/logger";
import { KeywordSearch, DBpediaResult } from "../models/DBpedia";


export async function queryDBpedia(input: string, queryClass: string = "", maxHits: number = 100): Promise<number> {
    try {
        const queryString = encodeURIComponent(input.trim());
        const res = await got(`http://lookup.dbpedia.org/api/search/KeywordSearch?QueryString=${queryString}&QueryClass=${queryClass}&MaxHits=${maxHits}`);
        if (res && res.body) {
            try {
                const ks: KeywordSearch = JSON.parse(convert.xml2json(res.body, {compact: true, spaces: 4}));
                logger.info(`The query for '${input}' returned ${ks.ArrayOfResult.Result.length} results.`);
                return Promise.resolve(ks.ArrayOfResult.Result.length);
            } catch (err) {
                // No body returned -> 0 results
            }
        }
        return Promise.resolve(0);
    } catch (err) {
        logger.error(err.response.body || err);
        return Promise.reject("Error querying DBpedia.");
    }
}

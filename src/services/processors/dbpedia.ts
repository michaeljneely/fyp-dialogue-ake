import * as got from "got";
import * as convert from "xml-js";
import { KeywordSearch } from "../../models/DBpedia";
import { logger } from "../../utils/logger";

/*
    Service to abstract communication with DBpedia and processing of results
*/

/**
 * Query DBpedia
 * @param {string} input Input string
 * @param {string} queryClass Query Class (optional)
 * @param {number} maxHits Max Hits (optional)
 */
export async function queryDBpedia(input: string, queryClass: string = "", maxHits: number = 50): Promise<KeywordSearch> {
    try {
        const queryString = encodeURIComponent(input.trim());
        const res = await got(`http://lookup.dbpedia.org/api/search/KeywordSearch?QueryString=${queryString}&QueryClass=${queryClass}&MaxHits=${maxHits}`);
        if (res !== undefined && res.body !== undefined) {
            try {
                const ks: KeywordSearch = JSON.parse(convert.xml2json(res.body, {compact: true, spaces: 4}));
                return Promise.resolve(ks);
            } catch (err) {
                // No body returned -> 0 results
            }
        }
        return Promise.resolve(undefined);
    } catch (err) {
        logger.error(err.response.body || err);
        return Promise.reject("Error querying DBpedia.");
    }
}

/**
 * Query dbpedia and get a measure of a term's specificity from the number of results returned
 * Specificity in range 0 -> 1, With 1 being extremely specific
 * @param {string} input Input string
 */
export async function getDBpediaScore(input: string): Promise<number> {
    try {
        const ks = await queryDBpedia(input);
        if (ks && ks.ArrayOfResult.Result && ks.ArrayOfResult.Result.length > 0) {
            if (ks.ArrayOfResult.Result.length === 1) {
                return 1;
            }
            else return ((51 - ks.ArrayOfResult.Result.length) / 50);
        }
        else {
            return 0;
        }
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

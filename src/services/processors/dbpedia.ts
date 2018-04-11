import * as got from "got";
import _ = require("lodash");
import * as convert from "xml-js";
import { KeywordSearch } from "../../models/DBpedia";
import { DBpediaScoreModel } from "../../models/DBpedia";
import { sleep } from "../../utils/functions";
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
        logger.info(`queryDBpedia() called. Querying for '${input}'`);
        const queryString = encodeURIComponent(input.trim());
        await sleep(2000);
        const res = await got(`http://lookup.dbpedia.org/api/search/KeywordSearch?QueryString=${queryString}&QueryClass=${queryClass}&MaxHits=${maxHits}`);
        if (res && res.body) {
            const ks: KeywordSearch = JSON.parse(convert.xml2json(res.body, {compact: true, spaces: 4}));
            return ks;
        }
        else {
            return undefined;
        }
    }
    catch (error) {
        logger.error(error);
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
        logger.info(`Getting DBpedia Score for ${input}`);
        const term = input.toLowerCase().trim();
        const existingScore = await DBpediaScoreModel.findOne({term});
        if (!existingScore) {
            const ks = await queryDBpedia(input);
            if (ks && ks.ArrayOfResult) {
                // For Scores with no Results, ArrayOfResult has information, but no items. Need to catch.
                try {
                    const score = ks.ArrayOfResult.Result.length || 1;
                    const scoreModel = await new DBpediaScoreModel({
                        term,
                        numResults: score
                    }).save();
                    return ( (51 - scoreModel.numResults) / 50);
                }
                catch (error) {
                    const scoreModel = await new DBpediaScoreModel({
                        term,
                        numResults: 0
                    }).save();
                    return 0;
                }
            }
            else {
                const scoreModel = await new DBpediaScoreModel({
                    term,
                    numResults: 0
                }).save();
                return 0;
            }
        }
        else {
            return (existingScore.numResults === 0) ? 0 : ((51 - existingScore.numResults) / 50);
        }
    }
    catch (error) {
        logger.error(error);
        return Promise.reject("Could not get DBpedia Score");
    }
}

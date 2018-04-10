import { uniq } from "lodash";
import * as filters from "../constants/filters";
import { logger } from "./logger";

/**
 * Perform a Fisher-Yates Shuffle
 * @param {Array<any>} array Array of any type
 * @returns {Array<any>} Shuffled Array
 */
export function shuffle(array: Array<any>) {
    let currentIndex = array.length;
    let temporaryValue, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

/**
 * Generated a 2D Number array of width x and length y
 * @param x
 * @param y
 */
export function make2DNumberArray(x: number, y: number) {
    const arr = new Array<Array<number>>();
    for (let i = 0; i < x; i++) {
        arr[i] = new Array<number>();
        for (let j = 0; j < y; j++) {
            arr[i][j] = 0;
        }
    }
    return arr;
}

/**
 * Use the speaker regex to remove the speakers from a conversation
 * @param {string} conversation Raw text of conversation
 * @returns {[Array<string>, string]} Speaker and Speaker-Removed Conversation Tuple
 */
export function stripSpeakers(conversation: string): [Array<string>, string] {
    const speakers: Array<string> = [];
    logger.info(`conversation before${conversation}`);
    const text =  conversation.replace(filters.speakerRegex, ((speaker: string) => {
        speakers.push(speaker.trim().replace(":", ""));
        return "";
    }));
    logger.info(`conversation after${text}`);
    return [uniq(speakers), text];
}

/**
 * Replace smart quotes with regular ones
 * @param {string} text Text to parse
 * @returns {string} Smart quote - free text
 */
export function replaceSmartQuotes(text: string): string {
    return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\,]/g, "");
}

/**
 * Remove all stopwords from a string as defined by the stopword filter
 * @param {string} text Text with possible stopwords
 * @returns {string} Stopword-free text
 */
export function replaceStopWords(text: string): string {
    return text.split(" ").filter((word: string) => {
        return filters.stopwords.indexOf(word.toLowerCase().trim()) === -1;
    }).join(" ");
}

/**
 * Normalize each string in an array by reducing to lower case and trimming
 * @param {Array<string>} array String array
 * @returns {Array<string>} Normalized string array
 */
export function normalizeStringArray(array: Array<string>): Array<string> {
    return array.map((element: string) => {
        if (element) {
            return element.toLowerCase().trim();
        }
    });
}

/**
 * Reduce a number between 0 and 1, given a range
 * I.e. 12 in range [0,24] becomes 0.5
 * @param {number} num Number to reduce
 * @param {number} min Range minimum
 * @param {number} max Range maximum
 */
export function reduceNumberInRange(num: number, min: number, max: number): number {
    return ((max - num) / (max - min));
}

/**
 * Sleep for X ms
 * @param ms Milliseconds
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


export function permute(input: Array<any>): Array<Array<any>> {
    const ret = new Array<any>();

    const permute = (arr: Array<any>, m: Array<any> = []) => {
        if (arr.length === 0) {
            ret.push(m);
        }
        else {
            for (let i = 0; i < arr.length; i++) {
                const current = arr.slice();
                const next = current.splice(i, 1);
                permute(current.slice(), m.concat(next));
            }
        }
   };

   permute(input);

   return ret;
}

export async function asyncFilter(arr: Array<any>, callback: Function) {
    return (await Promise.all(arr.map(async item => {
         return (await callback(item)) ? item : undefined;
    }))).filter((i: any) => i !== undefined);
}

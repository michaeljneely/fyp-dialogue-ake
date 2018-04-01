import { uniq } from "lodash";
import *  as filters from "../constants/filters";

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

export function stripSpeakers(document: string): [Array<string>, string] {
    const speakers: Array<string> = [];
    const text =  document.replace(filters.speakerRegex, ((speaker: string) => {
        speakers.push(speaker.trim().replace(":", ""));
        return "";
    }));
    return [uniq(speakers), text];
}

export function replaceSmartQuotes(text: string): string {
    return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\,]/g, "");
}

export function replaceStopWords(text: string): string {
    return text.split(" ").filter((word: string) => {
        return filters.stopwords.indexOf(word.toLowerCase().trim()) === -1;
    }).join(" ");
}

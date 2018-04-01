export interface IReference {
    textFile: string;
    summaries: {
        short: string;
        medium: string;
        long: string;
    };
    keywords: Array<string>;
}

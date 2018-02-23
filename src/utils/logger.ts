import { Logger, transports } from "winston";

const logLevel = (process.env.NODE_ENV === "development") ? "debug" : "info";


export class Stream {
    write(text: string) {
        logger.info(text);
    }
}

export const logger = new Logger({
    transports: [
        new transports.Console({
            colorize: true
        }),
        new transports.File({
            filename: process.env.LOG_FILE_INFO
        })
    ],
    exceptionHandlers: [
        new transports.Console({
            colorize: true
        }),
        new transports.File({
            filename: process.env.LOG_FILE_PANIC
        })
    ]
});

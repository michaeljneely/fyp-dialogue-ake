import { logger } from "../utils/logger";
import { Message, MessageModel } from "../models/Message";

/**
 * Store contact form message
 * @param {string} name Sender name
 * @param {string} email Sender email
 * @param {string} text Sender message
 * @returns {Promise<Message>} Stored message
 */
export async function storeMessage(name: string, email: string, text: string): Promise<Message> {
    try {
        const message = await new MessageModel({
            fromName: name,
            fromEmail: email,
            message: text
        }).save();
        logger.info(`Message from ${email} stored.`);
        return Promise.resolve(message);
    }
    catch (err) {
        logger.error(`Error storing contact message.\n${err}`);
        return Promise.reject("Error storing contact message");
    }
}

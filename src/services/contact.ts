import { Message, MessageModel } from "../models/Message";
import { logger } from "../utils/logger";

/**
 * Store a contact form's message
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
        return Promise.resolve(message);
    }
    catch (err) {
        logger.error(`Error storing contact message.\n${err}`);
        return Promise.reject("Error storing contact message");
    }
}

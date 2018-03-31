
import { logger } from "../utils/logger";
import { Message, MessageModel } from "../models/Message";

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
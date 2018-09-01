import * as mongoose from "mongoose";
import { prop, Typegoose } from "typegoose";

export class Message extends Typegoose {
    @prop({ required: true })
    fromName: string;
    @prop({ required: true, index: true })
    fromEmail: string;
    @prop({ required: true })
    message: string;
}

export const MessageModel = new Message().getModelForClass(Message, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

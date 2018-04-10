import * as mongoose from "mongoose";
import { prop, Typegoose } from "typegoose";

export class DBpediaScore extends Typegoose {
    @prop({ required: true, index: true })
    term: string;

    @prop()
    numResults: number;
}

export const DBpediaScoreModel = new DBpediaScore().getModelForClass(DBpediaScore, {
    existingConnection: mongoose.connection,
    schemaOptions : {
        timestamps: true
    }
});

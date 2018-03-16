import * as bcrypt from "bcrypt-nodejs";
import * as crypto from "crypto";
import * as mongoose from "mongoose";
import { Role } from "../controllers/acl";
import { pre, prop, instanceMethod, staticMethod, Typegoose, ModelType, InstanceType } from "typegoose";

/**
 * Password hash middleware.
 */
@pre<User>("save", function(next) {
    if (!this.isModified("password")) {
        next();
    }
    bcrypt.genSalt(10, (err, salt) => {
        if (err) { return next(err); }
        bcrypt.hash(this.password, salt, undefined, (err: mongoose.Error, hash) => {
        if (err) { return next(err); }
        this.password = hash;
        next();
        });
    });
})

export class User extends Typegoose {
    @prop({ required: true, unique: true })
    email: string;
    @prop({ required: true })
    password: string;
    @prop()
    passwordResetToken?: string;
    @prop()
    passwordResetExpires?: Date;
    @prop({ required: true })
    role: Role;
    @prop()
    tokens?: AuthToken[];
    @prop()
    profile?: {
        name: string,
        gender: string,
        location: string,
        website: string,
        picture: string
    };

    @instanceMethod
    comparePassword(candidatePassword: string, cb: (err: any, isMatch: any) => {}): void {
        bcrypt.compare(candidatePassword, this.password, (err: mongoose.Error, isMatch: boolean) => {
          cb(err, isMatch);
        });
      }

    /**
     * Helper method for getting user's gravatar.
     */
    @instanceMethod
    gravatar(size: number): string {
        if (!size) {
          size = 200;
        }
        if (!this.email) {
          return `https://gravatar.com/avatar/?s=${size}&d=retro`;
        }
        const md5 = crypto.createHash("md5").update(this.email).digest("hex");
        return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
    }
}

export type AuthToken = {
  accessToken: string,
  kind: string
};

export const UserModel = new User().getModelForClass(User, {schemaOptions: {timestamps: true}});

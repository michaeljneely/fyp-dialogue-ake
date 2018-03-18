import { Role } from "../controllers/acl";
import { AuthToken, User, UserModel, Profile } from "../models/User";
import * as mongoose from "mongoose";
import { WriteError } from "mongodb";
import * as mailService from "./mail";
import * as crypto from "crypto";

export async function signup(email: string, password: string, role: Role): Promise<User> {
    const UserModel = new User().getModelForClass(User, { existingMongoose: mongoose });
    const profile: Profile = {
        name: "",
        gender: "",
        location: "",
        website: "",
        picture: "",
    };
    const user = new UserModel({
        email,
        password,
        role: "user",
        profile
    });
    const existingUser = await UserModel.findOne({email});
    if (existingUser) {
        return Promise.reject("Account with that email address already exists.");
    }
    else {
        try {
            await user.save();
        } catch (err) {
           return Promise.reject(err);
        }
        return Promise.resolve(user);
    }
}

export async function updateProfile(userId: mongoose.Types.ObjectId, email: string, profile: Profile ): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        user.email = email;
        user.profile = profile;
        await user.save();
        return Promise.resolve();
    } catch (err) {
        if (err.code && err.code === 11000) {
            err = "The email address you have entered is already associated with an account.";
        }
        return Promise.reject(err);
    }
}

export async function updatePassword(userId: mongoose.Types.ObjectId, password: string): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        user.password = password;
        await user.save();
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function deleteAccount(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
        await UserModel.remove({_id: userId});
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

// Eventually allow login via Google, Facebook, Twitter, etc...
export async function performOauthUnlink(userId: mongoose.Types.ObjectId, provider: string): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        // Remove user[provider] here
        user.tokens = user.tokens.filter((token: AuthToken) => token.kind !== provider);
        await user.save();
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function resetPassword(passwordResetToken: string, newPassword: string) {
    try {
        const user = await UserModel.findOne({passwordResetToken}).where("passwordResetExpires").gt(Date.now());
        if (!user) {
            throw "Your reset token has expired!";
        }
        user.password = newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        await mailService.sendPasswordResetConfirmation(user.email);
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function getResetToken(passwordResetToken: string): Promise<User> {
    try {
        const user = await UserModel.findOne({ passwordResetToken }).where("passwordResetExpires").gt(Date.now());
        return Promise.resolve(user);
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function forgottenPassword(email: string, host: string) {
    try {
        const token = await crypto.randomBytes(16).toString("hex");
        const user = await UserModel.findOne({email});
        if (!user) {
            throw "We couldn't find an account associated with that email.";
        }
        user.passwordResetToken = token;
        user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();
        await mailService.sendResetPasswordEmail(email, token, host);
        console.log("resolving!");
        return Promise.resolve();
    } catch (err) {
        console.log(err);
        return Promise.reject(err);
    }
}

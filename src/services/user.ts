import * as crypto from "crypto";
import { ObjectId } from "mongodb";
import * as mongoose from "mongoose";
import { Role } from "../config/acl";
import { AuthToken, Profile, User, UserModel } from "../models/User";
import { logger } from "../utils/logger";
import * as mailService from "./mail";

/**
 * Create and save new user
 * @param {string} email User email (unique)
 * @param {string} password User password
 * @param {Role} role User role
 * @returns {User} New user object
 */
export async function signup(email: string, password: string, role: Role): Promise<User> {
    try {
        const user = new UserModel({
            email,
            password,
            role: "user",
            profile: {
                name: "",
                gender: "",
                location: "",
                website: "",
                picture: "",
            }
        });
        const existingUser = await UserModel.findOne({email});
        if (existingUser) {
            throw "An account with that email address already exists.";
        }
        const newUser = await user.save();
        return Promise.resolve(newUser);
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Update user profile information
 * @param {ObjectId} userId User ID
 * @param {string} email User email (unique)
 * @param {Profile} profile Updated profile
 */
export async function updateProfile(userId: mongoose.Types.ObjectId, email: string, profile: Profile ): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        user.email = email;
        user.profile = profile;
        await user.save();
        return Promise.resolve();
    }
    catch (error) {
        if (error.code && error.code === 11000) {
            error = "The email address you have entered is already associated with an account.";
        }
        return Promise.reject(error);
    }
}

/**
 * Update user password
 * @param {ObjectId} userId User ID
 * @param {string} password New user password
 */
export async function updatePassword(userId: mongoose.Types.ObjectId, password: string): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        user.password = password;
        await user.save();
        return Promise.resolve();
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Delete user account
 * @param {string} email User email for verification
 * @param {ObjectId} userId User ID
 */
export async function deleteAccount(email: string, userId: mongoose.Types.ObjectId): Promise<void> {
    try {
        const user = await UserModel.findOne({email});
        const id = new ObjectId(userId);
        if (user && id.equals(user._id)) {
            await UserModel.remove({_id: userId});
            return Promise.resolve();
        }
        else {
            logger.error(`Unauthorized Account Deletion performed by ${user._id} attempting to delete ${userId}'s account.`);
            throw "Unauthorized";
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Unlink specified OAuth provider
 * (Eventually allow login via Google, Facebook, Twitter, etc...)
 * @param {ObjectId} userId User ID
 * @param {string} provider OAuth provider
 */
export async function performOauthUnlink(userId: mongoose.Types.ObjectId, provider: string): Promise<void> {
    try {
        const user = await UserModel.findById(userId);
        if (user) {
             // Remove user[provider] here
            user.tokens = user.tokens.filter((token: AuthToken) => token.kind !== provider);
            await user.save();
            return Promise.resolve();
        }
        else {
            logger.error(`Cannot perform OauthUnlink - User ${userId} Not Found`);
            throw "Cannot perform OauthUnlink - User Not Found";
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Reset User Password
 * @param {string} passwordResetToken Password reset token
 * @param {string} newPassword New password to save
 */
export async function resetPassword(passwordResetToken: string, newPassword: string): Promise<void> {
    try {
        const user = await UserModel.findOne({passwordResetToken}).where("passwordResetExpires").gt(Date.now());
        if (user) {
            user.password = newPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            await mailService.sendPasswordResetConfirmation(user.email);
            return Promise.resolve();
        }
        else {
            logger.error(`Reset token ${passwordResetToken} has expired.`);
            throw "Your reset token has expired!";
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Check to see if the reset token exists
 * @param {string} passwordResetToken Reset token for Users
 * @returns {boolean} True if reset token exists
 */
export async function resetTokenExists(passwordResetToken: string): Promise<boolean> {
    try {
        const user = await UserModel.findOne({ passwordResetToken }).where("passwordResetExpires").gt(Date.now());
        if (user) {
            return Promise.resolve(true);
        }
        else {
            logger.error(`Could not find reset token ${passwordResetToken}`);
            throw "Reset token could not be found";
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Generate and save password reset token for specified email
 * @param {string} email User email
 */
export async function generateResetToken(email: string): Promise<void> {
    try {
        const token = await crypto.randomBytes(16).toString("hex");
        const user = await UserModel.findOne({email});
        if (user) {
            user.passwordResetToken = token;
            user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
            await user.save();
            await mailService.sendResetPasswordEmail(email, token);
            return Promise.resolve();
        }
        else {
            logger.error(`No account associated with ${email}`);
            throw "We couldn't find an account associated with that email.";
        }
    }
    catch (error) {
        return Promise.reject(error);
    }
}

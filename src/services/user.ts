import { Role } from "../controllers/acl";
import { User, UserModel, Profile } from "../models/User";
import * as mongoose from "mongoose";
import { WriteError } from "mongodb";

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

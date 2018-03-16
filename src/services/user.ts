import { Role } from "../controllers/acl";
import { User, UserModel, Profile } from "../models/User";
import * as mongoose from "mongoose";
import { WriteError } from "mongodb";

export async function signup(email: string, password: string, role: Role): Promise<User> {
    const user = new UserModel({
        email: email,
        password: password,
        role: "user"
    });
    console.log("here!");
    const existingUser = await UserModel.findOne({email});
    console.log(existingUser);
    if (existingUser) {
        return Promise.reject("Account with that email address already exists.");
    }
    else {
        console.log("booping into here");
        try {
            await user.save();
        } catch (err) {
            console.log(err);
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

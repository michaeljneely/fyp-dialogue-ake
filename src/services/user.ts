import { Role } from "../controllers/acl";
import { User, UserModel } from "../models/User";

export async function signup(email: string, password: string, role: Role): Promise<User> {
    const user = new UserModel({
        email: email,
        password: password,
        role: "user"
    });
    const existingUser = await UserModel.findOne({email});
    if (existingUser) {
        return Promise.reject("Account with that email address already exists.");
    }
    else {
        await user.save();
        return Promise.resolve(user);
    }
}
import * as nodemailer from "nodemailer";
import { User, UserModel } from "../models/User";
import * as sg from "@sendgrid/mail";

export async function sendPasswordResetConfirmation(email: string): Promise<void> {
    try {
        await sg.send({
            to: email,
            from: "FYP@fyp.com",
            subject: "Your password has been changed",
            text: `Hello,\n\nThis is a confirmation that the password for your account ${email} has just been changed.\n`
        });
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

export async function sendResetPasswordEmail(email: string, token: string, host: string): Promise<void> {
    try {
        await sg.send({
            to: email,
            from: "FYP@fyp.com",
            subject: "Reset your password on FYP",
            text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste this into your browser to complete the process:\n\n
                http://${host}/reset/${token}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`,
            html:  `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
            Please click on the following link, or paste this into your browser to complete the process:\n\n
            <a href=http://${host}/reset/${token}\n\n> Reset </a>
            If you did not request this, please ignore this email and your password will remain unchanged.\n`,
        });
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}
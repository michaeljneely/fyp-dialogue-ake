import * as sg from "@sendgrid/mail";

/**
 * Send password reset confirmation via sendgrid
 * @param {string} email Sender email
 */
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

/**
 * Send password reset prompt via sendgrid
 * @param {string} email Sender email
 * @param {string} token Password reset token
 */
export async function sendResetPasswordEmail(email: string, token: string): Promise<void> {
    try {
        await sg.send({
            to: email,
            from: process.env.EMAIL_DOMAIN,
            subject: "Reset your password on FYP",
            text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste this into your browser to complete the process:\n\n
                http://${process.env.WEB_ADDRESS}/reset/${token}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`,
            html:  `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
            Please click on the following link, or paste this into your browser to complete the process:\n\n
            <a href=http://${process.env.WEB_ADDRESS}/reset/${token}\n\n> Reset </a>
            If you did not request this, please ignore this email and your password will remain unchanged.\n`,
        });
        return Promise.resolve();
    }
    catch (err) {
        return Promise.reject(err);
    }
}

/**
 * Message site host via contact form
 * @param {string} name Sender name
 * @param {string} email Sender email
 * @param {string} message Sender message
 */
export async function contactHost(name: string, email: string, message: string) {
    try {
        await sg.send({
            to: `${process.env.HOST_EMAIL}`,
            from: `${name} <${email}>`,
            subject: "New Message From Contact Form",
            text: message
        });
        return Promise.resolve();
    }
    catch (err) {
        return Promise.reject(err);
    }
}

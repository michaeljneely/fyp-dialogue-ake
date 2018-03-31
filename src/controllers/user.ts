import * as express from "express";
import * as passport from "passport";
import * as passportConfig from "../config/passport";
import * as userService from "../services/user";

import { accessControl } from "../app";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { IVerifyOptions } from "passport-local";
import { logger } from "../utils/logger";
import { Request, Response, NextFunction } from "express";
import { User, UserModel, AuthToken, Profile } from "../models/User";

/**
 * GET /login - Render login page
 * @param req Express Request
 * @param res Express Response
 */
function getLogin(req: Request, res: Response) {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("account/login", {
        title: "Login"
    });
}

/**
 * POST /login - Sign in using email and password
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.email User email
 * @param {string} req.body.password User password
 */
function postLogin(req: Request, res: Response, next: NextFunction) {
    req.assert("email", "Email is not valid").isEmail();
    req.assert("password", "Password cannot be blank").notEmpty();
    req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/login");
    }

    passport.authenticate("local", (err: Error, user: any, info: IVerifyOptions) => {
        if (err) { return next(err); }
        if (!user) {
            req.flash("errors", info.message);
            return res.redirect("/login");
        }
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            req.flash("success", { msg: "Success! You are logged in." });
            res.redirect(req.session.returnTo || "/");
        });
    })(req, res, next);
}

/**
 * GET /logout - Perform logout action
 * @param req Express Request
 * @param res Express Response
 */
function logout(req: Request, res: Response) {
    req.logout();
    res.redirect("/");
}

/**
 * GET /signup - Render signup page.
 * @param req Express Request
 * @param res Express Response
 */
function getSignup(req: Request, res: Response) {
    // Only render if not already logged in
    if (req.user) {
        return res.redirect("/");
    }
    res.render("account/signup", {
        title: "Create Account"
    });
}

/**
 * POST /signup - Create a new local account.
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.email User email
 * @param {string} req.body.password User password
 * @param {string} req.body.confirmPassword Confirm user password
 */
async function postSignup(req: Request, res: Response) {
    req.assert("email", "Email is not valid").isEmail();
    req.assert("password", "Password must be at least 4 characters long").len({ min: 4 });
    req.assert("confirmPassword", "Passwords do not match").equals(req.body.password);
    req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/signup");
    }

    try {
        const user = await userService.signup(req.body.email, req.body.password, "user");
        req.logIn(user, (err) => {
            if (err) {
                return Promise.reject(err);
            }
            return res.redirect("/");
        });
    }
    catch (error) {
        logger.error(error);
        req.flash("errors", { msg: "Oops! There was an error creating your account." });
        return res.redirect("/signup");
    }
}

/**
 * GET /account - Render profile page.
 * @param req Express Request
 * @param res Express Response
 */
function getAccount(req: Request, res: Response) {
    const permission = accessControl.can(req.user.role).readOwn("account");
    if (permission.granted) {
        res.render("account/profile", {
            title: "Account Management"
        });
    } else {
        res.status(403).send("Access Denied");
    }
}

/**
 * POST /account/profile - Update profile information.
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.email User Email
 * @param {Profile} req.body.profile User Profile
 */
async function postUpdateProfile(req: Request, res: Response) {
    req.assert("email", "Please enter a valid email address.").isEmail();
    req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/account");
    }

    try {
        const email = req.body.email || "";
        const profile: Profile = {
            name: req.body.name || "",
            gender: req.body.gender || "",
            location: req.body.location || "",
            website: req.body.website || "",
        };

        await userService.updateProfile(req.user.id, email, profile);

        req.flash("success", { msg: "Profile information has been updated." });
        res.redirect("/account");

    }
    catch (error) {
        logger.error(error);
        req.flash("errors", {msg: "Oops! There was an issue updating your account."});
        return res.redirect("/account");
    }
}

/**
 * POST /account/password - Update current password.
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.password New user password
 */
async function postUpdatePassword(req: Request, res: Response) {
    req.assert("password", "Password must be at least 4 characters long").len({ min: 4 });
    req.assert("confirmPassword", "Passwords do not match").equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/account");
    }
    try {
        await userService.updatePassword(req.user.id, req.body.password);
        req.flash("success", { msg: "Password has been changed." });
        res.redirect("/account");
    }
    catch (error) {
        logger.error(error);
        req.flash("error", { msg: "Oops! There was an issue updating your password."});
        return Promise.reject(error);
    }
}

/**
 * POST /account/delete - Delete user account.
 * @param req Express Request
 * @param res Express Response
 */
async function postDeleteAccount(req: Request, res: Response) {
    try {
        await userService.deleteAccount(req.user.id);
        req.logout();
        req.flash("info", { msg: "Your account has been deleted." });
        res.redirect("/");
    }
    catch (error) {
        logger.info(error);
        req.flash("error", { msg: "Oops! There was an issue deleting your account."});
        return Promise.reject(error);
    }
}

/**
 * GET /account/unlink/:provider - Unlink OAuth provider
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.params.provider OAuth provider
 */
async function getOauthUnlink(req: Request, res: Response) {
    const provider: string = req.params.provider;
    try {
        await userService.performOauthUnlink(req.user.id, provider);
        req.flash("info", { msg: `${provider} account has been unlinked.` });
        res.redirect("/account");
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

 /**
  * GET /reset/:token - Reset Password page.
  * @param req Express Request
  * @param res Express Response
  * @param {string} req.params.token Password reset token
  */
export async function getReset(req: Request, res: Response) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    try {
        const user: User = await userService.getResetToken(req.params.token);
        if (!user) {
            req.flash("errors", { msg: "Password reset token is invalid or has expired." });
            return res.redirect("/forgot");
        }
        res.render("account/reset", {
            title: "Password Reset"
        });
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * POST /reset/:token - Process the reset password request
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.password New user password
 * @param {string} req.body.confirm Confirm user password
 */
export async function postReset(req: Request, res: Response) {
    req.assert("password", "Password must be at least 4 characters long.").len({ min: 4 });
    req.assert("confirm", "Passwords must match.").equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("back");
    }

    try {
        await userService.resetPassword(req.params.token, req.body.password);
        req.flash("success", { msg: "Success! Your password has been changed." });
        res.redirect("/");
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * GET /forgot - Render forgot Password page
 * @param req Express Request
 * @param res Express Response
 */
function getForgot(req: Request, res: Response) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    res.render("account/forgot", {
        title: "Forgot Password"
    });
}

/**
 * POST /forgot - Create a random token, then the send user an email with a reset link
 * @param req Express Request
 * @param res Express Response
 * @param {string} req.body.email Email to send token to
 */
export async function postForgot(req: Request, res: Response) {
    req.assert("email", "Please enter a valid email address.").isEmail();
    req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/forgot");
    }

    try {
        await userService.forgottenPassword(req.body.email, req.headers.host);
        req.flash("info", { msg: `An e-mail has been sent to ${req.body.email} with further instructions.` });
    }
    catch (error) {
        logger.error(error);
        req.flash("errors", {msg: error});
    }
    finally {
        res.redirect("/forgot");
    }
}

// Create Routes
const userAPI = express.Router();

/**
 * GET /login
 * Render login page
 * Authentication Required - False
 */
userAPI.get("/login", getLogin);

/**
 * POST /login
 * Perform login action
 * Authentication Required - False
 */
userAPI.post("/login", postLogin);

/**
 * GET /logout
 * Perform logout action
 * Authentication Required - False
 */
userAPI.get("/logout", logout);

/**
 * GET /forgot
 * Render forgotten password page
 * Authentication Required - False
 */
userAPI.get("/forgot", getForgot);

/**
 * POST /forgot
 * Send password reset token
 * Authentication Required - False
 */
userAPI.post("/forgot", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postForgot(req, res);
}));

/**
 * GET /reset/:token
 * Render reset passowrd page
 * Authentication Required - False
 */
userAPI.get("/reset/:token", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return getReset(req, res);
}));

/**
 * POST /reset/:token
 * Perform reset password action
 * Authentication Required - False
 */
userAPI.post("/reset/:token", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postReset(req, res);
}));

/**
 * GET /signup
 * Render signup page
 * Authentication Required - False
 */
userAPI.get("/signup", getSignup);

/**
 * POST /signup
 * Perform signup action
 * Authentication Required - False
 */
userAPI.post("/signup", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return postSignup(req, res);
}));

/**
 * GET /account/profile
 * Render account page
 * Authentication Required - True
 */
userAPI.get("/account", passportConfig.isAuthenticated, getAccount);

/**
 * POST /account/profile
 * Update account information
 * Authentication Required - True
 */
userAPI.post("/account/profile", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postUpdateProfile(req, res);
}));

/**
 * POST /account/password
 * Update account password
 * Authentication Required - True
 */
userAPI.post("/account/password", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postUpdatePassword(req, res);
}));

/**
 * POST /account/delete
 * Delete account
 * Authentication Required - True
 */
userAPI.post("/account/delete", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postDeleteAccount(req, res);
}));

/**
 * POST /account/unlink/:provider
 * Unlink specified OAuth provider
 * Authentication Required - True
 */
userAPI.get("/account/unlink/:provider", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return getOauthUnlink(req, res);
}));

// Expose Routes
export default userAPI;

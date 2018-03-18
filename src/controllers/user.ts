import * as express from "express";
import * as passport from "passport";
import { User, UserModel, AuthToken, Profile } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { IVerifyOptions } from "passport-local";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl } from "../app";
import * as userService from "../services/user";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import * as passportConfig from "../config/passport";


/**
 * GET /login
 * Login page.
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
 * POST /login
 * Sign in using email and password.
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
 * GET /logout
 * Log out.
 */
function logout(req: Request, res: Response) {
    req.logout();
    res.redirect("/");
}

/**
 * GET /signup
 * Signup page.
 */
function getSignup(req: Request, res: Response) {
    if (req.user) {
        return res.redirect("/");
    }
    res.render("account/signup", {
        title: "Create Account"
    });
}

/**
 * POST /signup
 * Create a new local account.
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
    } catch (error) {
        req.flash("errors", { msg: error });
        return res.redirect("/signup");
    }
}

/**
 * GET /account
 * Profile page.
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
 * POST /account/profile
 * Update profile information.
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

    } catch (err) {
        req.flash("errors", {msg: err});
        return res.redirect("/account");
    }
}

/**
 * POST /account/password
 * Update current password.
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
    } catch (err) {
        req.flash("error", { msg: "ERROR"});
        return Promise.reject(err);
    }
}

/**
 * POST /account/delete
 * Delete user account.
 */
async function postDeleteAccount(req: Request, res: Response) {
    try {
        await userService.deleteAccount(req.user.id);
        req.logout();
        req.flash("info", { msg: "Your account has been deleted." });
        res.redirect("/");
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
async function getOauthUnlink(req: Request, res: Response) {
    const provider = req.params.provider as string;
    try {
        await userService.performOauthUnlink(req.user.id, provider);
        req.flash("info", { msg: `${provider} account has been unlinked.` });
        res.redirect("/account");
    } catch (err) {
        return Promise.reject(err);
    }
}

 /**
  * GET /reset/:token
  * Reset Password page.
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
    } catch (err) {
        return Promise.reject(err);
    }
}

// /**
//  * POST /reset/:token
//  * Process the reset password request.
//  */
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
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * GET /forgot
 * Forgot Password page.
 */
function getForgot(req: Request, res: Response) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    res.render("account/forgot", {
        title: "Forgot Password"
    });
}

// /**
//  * POST /forgot
//  * Create a random token, then the send user an email with a reset link.
//  */
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
    } catch (err) {
        req.flash("errors", {msg: err});
    } finally {
        res.redirect("/forgot");
    }
}

const userAPI = express.Router();

userAPI.get("/login", getLogin);
userAPI.post("/login", postLogin);
userAPI.get("/logout", logout);
userAPI.get("/forgot", getForgot);
userAPI.post("/forgot", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postForgot(req, res);
}));
userAPI.get("/reset/:token", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return getReset(req, res);
}));
userAPI.post("/reset/:token", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postReset(req, res);
}));
userAPI.get("/signup", getSignup);
userAPI.post("/signup", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return postSignup(req, res);
}));
userAPI.post("/account/profile", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postUpdateProfile(req, res);
}));
userAPI.get("/account", passportConfig.isAuthenticated, getAccount);
userAPI.post("/account/password", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postUpdatePassword(req, res);
}));
userAPI.post("/account/delete", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postDeleteAccount(req, res);
}));
userAPI.get("/account/unlink/:provider", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return getOauthUnlink(req, res);
}));

export default userAPI;

import * as passport from "passport";
import * as request from "request";
import * as passportLocal from "passport-local";
import * as _ from "lodash";

import { UserModel } from "../models/User";
import { Request, Response, NextFunction } from "express";

/*
    Define Passport Authentication Configuration

    Supported Strategies
        - Local
            - Authenticate with (email, password)

*/

const LocalStrategy = passportLocal.Strategy;

/**
 * Serialize User
 */
passport.serializeUser<any, any>((user, done) => {
    done(undefined, user._id);
});

/**
 * Deserialize User
 */
passport.deserializeUser((id, done) => {
    UserModel.findById(id, (err, user) => {
        done(err, user);
    });
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    UserModel.findOne({ email: email.toLowerCase() }, (err, user: any) => {
        if (err) { return done(err); }
        if (!user) {
            return done(undefined, false, { message: `Email ${email} not found.` });
        }
        user.comparePassword(password, (err: Error, isMatch: boolean) => {
            if (err) { return done(err); }
            if (isMatch) {
                return done(undefined, user);
            }
            return done(undefined, false, { message: "Invalid email or password." });
        });
    });
}));

/**
 * Login Required middleware.
 */
export let isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
};

/**
 * Authorization Required middleware.
 */
export let isAuthorized = (req: Request, res: Response, next: NextFunction) => {
    const provider = req.path.split("/").slice(-1)[0];

    if (_.find(req.user.tokens, { kind: provider })) {
        next();
    } else {
        res.redirect(`/auth/${provider}`);
    }
};

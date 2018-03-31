import * as mailService from "../services/mail";
import * as passportConfig from "../config/passport";
import * as sg from "@sendgrid/mail";
import { Request, Response, Router, NextFunction } from "express";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";

/**
 * Render contact form
 * @param req - Express Request
 * @param res - Express Response
 */
export function getContact(req: Request, res: Response) {
    res.render("contact", {
        title: "Contact"
    });
}

/**
 * Contact site host
 * @param req - Express Request
 * @param res - Express Response
 */
export async function postContact(req: Request, res: Response) {
    req.assert("name", "Name cannot be blank").notEmpty();
    req.assert("email", "Email is not valid").isEmail();
    req.assert("message", "Message cannot be blank").notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/contact");
    }

    try {
        await mailService.contactHost(req.body.name, req.body.email, req.body.message);
    }
    catch (err) {
        logger.error(err);
    }
    finally {
        req.flash("success", { msg: "Email has been sent successfully!" });
        return res.redirect("/contact");
    }
}

const contactAPI = Router();

/**
 * GET /contact
 * Contact form page.
 */
contactAPI.get("/contact", passportConfig.isAuthenticated, getContact);
/**
 * POST /contact
 * Send message to maintainer
 */
contactAPI.post("/contact", passportConfig.isAuthenticated, asyncMiddleware(async (req: Request, res: Response, next: NextFunction) => {
    return postContact(req, res);
}));

// Expose Routes
export default contactAPI;

import * as contactService from "../services/contact";
import * as mailService from "../services/mail";
import * as passportConfig from "../config/passport";
import * as sg from "@sendgrid/mail";

import { Request, Response, Router, NextFunction } from "express";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";

/**
 * GET /contact - Render contact form
 * @param req - Express Request
 * @param res - Express Response
 */
function getContact(req: Request, res: Response) {
    res.render("contact", {
        title: "Contact"
    });
}

/**
 * POST /contact - Contact site host
 * @param req - Express Request
 * @param res - Express Response
 */
async function postContact(req: Request, res: Response) {
    req.assert("name", "Name cannot be blank").notEmpty();
    req.assert("email", "Email is not valid").isEmail();
    req.assert("message", "Message cannot be blank").notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/contact");
    }

    try {
        const message = await contactService.storeMessage(req.body.name, req.body.email, req.body.message);
        await mailService.contactHost(message.fromName, message.fromEmail, message.message);
    }
    catch (err) {
        logger.error(err);
    }
    finally {
        req.flash("success", { msg: "Email has been sent successfully!" });
        logger.info(`Mail from ${req.body.email} sent to host.`);
        return res.redirect("/contact");
    }
}

// Create Routes
const contactAPI = Router();

/**
 * GET /contact
 * Render Contact form page.
 * Authentication Required - True
 */
contactAPI.get("/contact", passportConfig.isAuthenticated, getContact);

/**
 * POST /contact
 * Send message to maintainer
 * Authentication Required - True
 * Rate Limit - True
 */
contactAPI.post("/contact", passportConfig.isAuthenticated, asyncMiddleware(async (req: Request, res: Response, next: NextFunction) => {
    return postContact(req, res);
}));

// Expose Routes
export default contactAPI;

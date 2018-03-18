import * as sg from "@sendgrid/mail";
import { Request, Response, Router } from "express";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import * as mailService from "../services/mail";
import { logger } from "../utils/logger";

/**
 * GET /contact
 * Contact form page.
 */
export function getContact(req: Request, res: Response) {
    res.render("contact", {
        title: "Contact"
    });
}

/**
 * POST /contact
 * Send a contact form via Nodemailer.
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
    } catch (err) {
        logger.error(err);
    } finally {
        req.flash("success", { msg: "Email has been sent successfully!" });
        return res.redirect("/contact");
    }
}

const contactAPI = Router();

contactAPI.get("/contact", getContact);
contactAPI.post("/contact", postContact);

export default contactAPI;

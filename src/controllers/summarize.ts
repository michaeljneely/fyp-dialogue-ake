import * as express from "express";
import { Request, Response } from "express";
import * as passportConfig from "../config/passport";
import * as summaryService from "../services/summary";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";


/**
 * GET /summarize - Render summary form
 * @param req Express Request
 * @param res Express Response
 */
function index(req: Request, res: Response) {
    res.render("summarize", {
        title: "Summarize"
    });
}

/**
 * POST /summarize - Summarize text
 * @param req Express Request
 * @param {string} req.body.text Text to summarize
 * @param {number} req.body.wordLength Number of words to use in summary
 * @param res Express Response
 */
async function summarize(req: Request, res: Response) {
    req.assert("text", "Document cannot be blank").notEmpty();
    req.assert("wordLength", "Word Length must be numeric").isNumeric();
    req.assert("wordLength", "Word Length must be between 1 and 20").isInt({gt: 0, lt: 21});

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/summarize");
    }

    try {
        const summary = await summaryService.summarizeConversation(req.body.text, req.user.id, parseInt(req.body.wordLength));
        res.render("summary", {
            title: "Summary",
            summary: summary
        });
    }
    catch (err) {
        logger.error(err);
        return Promise.reject("A summary could not be provided at this time");
    }
}

// Create Routes
const summarizeAPI = express.Router();

/**
 * GET /summarize
 * Render summary page
 * Authentication Required - True
 */
summarizeAPI.get("/summarize", passportConfig.isAuthenticated, index);

/**
 * POST /summarize
 * Summarize text
 * Authentication Required - True
 * Rate Limit - True
 */
summarizeAPI.post("/summarize", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return summarize(req, res);
}));

// Expose Routes
export default summarizeAPI;

import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as express from "express";
import { NextFunction, Request, Response } from "express";
import * as passportConfig from "../config/passport";
import { annotators } from "../constants/annotators";
import { parseDocument } from "../services/corenlp";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";

/**
 * GET /parse - Render parse form
 * @param req Express Request
 * @param res Express Response
 */
function index(req: Request, res: Response) {
    res.render("parse", {
        title: "Parse"
    });
}

/**
 * POST /parse - View JSON output of Stanford CoreNLP Parsing
 * @param req Express Request
 * @param {string} req.body.text Text to parse
 * @param res Express Response
 */
async function parse(req: Request, res: Response) {
    req.assert("text", "There needs to be some text to parse!").notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/parse");
    }

    try {
        const parsed = await parseDocument(req.body.text, false);
        res.json(parsed.document.toJSON());
    } catch (err) {
        logger.error(err);
        return Promise.reject("Oops! There was an issue parsing this text.");
    }
}

// Create Routes
const parseAPI = express.Router();

/**
 * GET /parse
 * Render parse page
 * Authentication Required - True
 */
parseAPI.get("/parse", passportConfig.isAuthenticated, index);

/**
 * POST /parse
 * View JSON returned from CoreNLP Server
 * Authentication Required - True
 * Rate Limit - True
 */
parseAPI.post("/parse", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return parse(req, res);
}));

// Expose Routes
export default parseAPI;

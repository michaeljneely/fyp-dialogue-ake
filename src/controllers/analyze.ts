import * as express from "express";
import { Request, Response } from "express";
import * as fs from "fs-extra";
import { accessControl } from "../app";
import * as passportConfig from "../config/passport";
import * as analysisService from "../services/analyze";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";

/**
 * GET /analyze - Render analysis form
 * @param req - Express Request
 * @param res - Express Response
 */
function getAnalyze(req: Request, res: Response) {
    res.render("analyze", {
        title: "Analysis"
    });
}

/**
 * POST /analyze - Perform analysis on conversation
 * @param req - Express Request
 * @param {string} req.body.text Conversation text
 * @param {string} req.body.keywords User provided keywords
 * @param {string} req.body.shortSummary User short summary
 * @param {string} req.body.mediumSummary User medium-length summary
 * @param {string} req.body.longSummary User long summary
 * @param res - Express Response
 */
async function postAnalyze(req: Request, res: Response) {
    // At the moment all data is required
    req.assert("text", "Conversation cannot be blank.").notEmpty();
    req.assert("keywords", "Keywords cannot be blank").notEmpty();
    req.assert("shortSummary", "Short summary cannot be blank").notEmpty();
    req.assert("mediumSummary", "Medium summary cannot be blank").notEmpty();
    req.assert("longSummary", "Long summary cannot be blank").notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/analyze");
    }

    try {
        const results = await analysisService.analyzeUserConversation(req.user.id, req.body.text, req.body.keywords, req.body.shortSummary, req.body.mediumSummary, req.body.longSummary);
        res.render("results", {
            title: "Results",
            results: JSON.parse(JSON.stringify(results.results)),
            keywords: JSON.parse(JSON.stringify(results.keywords))
        });
    }
    catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

/**
 * POST /analyze/:documentId - Perform analysis on corpus conversation - Admin Only
 * @param req - Express Request
 * @param {string} req.body.text Conversation text
 * @param {string} req.params.documentId Document Id of conversation in corpus
 * @param res - Express Response
 */
async function postAnalyzeDocument(req: Request, res: Response) {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
        try {
            logger.info(`analyzing corpus document`);
            const documentId: string = req.params.documentId;
            const results = await analysisService.analyzeCorpusConversation(documentId);
            res.render("results", {
                title: "Results",
                results
            });
        }
        catch (error) {
            logger.error(error);
            return Promise.reject(error);
        }
    }
    else {
        res.status(403).send("Access Denied");
    }
}

// Create Routes
const analysisAPI = express.Router();

/**
 * GET /analyze
 * Render Analysis form page.
 * Authentication Required - True
 */
analysisAPI.get("/analyze", passportConfig.isAuthenticated, getAnalyze);

/**
 * POST /analyze
 * Perform analysis on conversation
 * Authentication Required - True
 * Rate Limit - True
 */
analysisAPI.post("/analyze", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postAnalyze(req, res);
}));

/**
 * POST /analyze/:documentId
 * Perform analysis on specified corpus conversation
 * Authentication Required - True
 * Admin Only - True
 */
analysisAPI.post("/analyze/:documentId", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return postAnalyzeDocument(req, res);
}));

// Expose Routes
export default analysisAPI;

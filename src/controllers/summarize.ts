import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as express from "express";
import { Request, Response } from "express";
import { annotators } from "../constants/annotators";
import { connector } from "../app";
import { logger } from "../utils/logger";
import * as summaryService from "../services/summary";
import * as passportConfig from "../config/passport";
import { asyncMiddleware } from "../utils/asyncMiddleware";

export function index(req: Request, res: Response) {
    res.render("summary", {
        title: "Summary"
    });
}

export async function summarize(req: Request, res: Response) {
    req.assert("text", "Document cannot be blank").notEmpty();
    req.assert("wordLength", "Word Length must be numeric").isNumeric();
    req.assert("wordLength", "Word Length must be between 1 and 20").isInt({gt: 0, lt: 21});

    const errors = req.validationErrors();

    if (errors) {
        req.flash("errors", errors);
        return res.redirect("/summarize");
    }

    try {
        const summaries = await summaryService.summarize(req.body.text, req.user.id, req.body.wordLength);
        res.json(summaries);
    } catch (err) {
        return Promise.reject(err);
    }
}

const summarizeAPI = express.Router();

summarizeAPI.get("/summarize", index);
summarizeAPI.post("/summarize", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return summarize(req, res);
}));

export default summarizeAPI;
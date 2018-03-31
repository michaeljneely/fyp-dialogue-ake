import * as express from "express";
import * as passportConfig from "../config/passport";
import * as corpusService from "../services/corpus" ;

import { accessControl } from "../app";
import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { logger } from "../utils/logger";

/**
 * Render corpus page - admin only
 * @param req - Express Request
 * @param res - Express Response
 */
async function displayCorpus(req: express.Request, res: express.Response) {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
        const documents = await CorpusDocumentModel.find({});
        // Some Summary statistics here ...
        res.render("corpus", {
            title: "Corpus",
            corpus: documents
        });
    }
    else {
        res.status(403).send("Access Denied");
    }
}

/**
 * Reconstruct corpus from database - admin only
 * @param req - Express Request
 * @param res - Express Response
 */
async function buildCorpus(req: express.Request, res: express.Response) {
    const permission = accessControl.can(req.user.role).deleteAny("corpus");
    if (permission.granted) {
        try {
            const sizeOfCorpus = await corpusService.buildCorpus();
            const message = `Corpus built from ${sizeOfCorpus} documents.`;
            logger.info(message);
            req.flash("success", {msg: message});
        }
        catch (error) {
            logger.error(error);
            req.flash("errors", {msg: "Oops! There was an issue rebuilding the corpus."});
        }
        finally {
            res.redirect("/corpus");
        }
    }
}

// Create Routes
const corpusAPI = express.Router();

/**
 * GET /corpus
 * Render corpus page
 * Authentication Required - True
 * Admin Only - True
 */
corpusAPI.get("/corpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return displayCorpus(req, res);
}));

/**
 * POST/corpus
 * Reconstruct corpus
 * Authentication Required - True
 * Admin Only - True
 */
corpusAPI.post("/corpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return buildCorpus(req, res);
}));

// Expose Routes
export default corpusAPI;

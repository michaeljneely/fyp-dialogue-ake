import * as express from "express";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl, connector } from "../app";
import { CorpusDocument, CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma } from "../models/CorpusLemma";
import * as corpusService from "../services/corpus" ;
import * as passportConfig from "../config/passport";
import { asyncMiddleware } from "../utils/asyncMiddleware";

/**
 * Render corpus page - admin only
 * @param req - Express Request
 * @param res - Express Response
 */
export async function displayCorpus(req: express.Request, res: express.Response): Promise<void> {
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
            req.flash("success", {msg: `Corpus built from ${sizeOfCorpus} documents.`});
        }
        catch (error) {
            req.flash("errors", {msg: error});
        }
        finally {
            res.redirect("/corpus");
        }
    }
}

// Create Routes
const corpusAPI = express.Router();

corpusAPI.get("/corpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return displayCorpus(req, res);
}));

corpusAPI.post("/corpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return buildCorpus(req, res);
}));

export default corpusAPI;
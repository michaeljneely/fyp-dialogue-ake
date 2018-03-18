import * as express from "express";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl, connector } from "../app";
import { CorpusDocument } from "../models/CorpusDocument";
import { CorpusLemma } from "../models/CorpusLemma";
import * as corpusService from "../services/corpus" ;
import * as passportConfig from "../config/passport";
import { asyncMiddleware } from "../utils/asyncMiddleware";

export async function displayCorpus(req: express.Request, res: express.Response) {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
      const CorpusDocumentModel = new CorpusDocument().getModelForClass(CorpusDocument);
      const documents = await CorpusDocumentModel.find({}).exec();
      res.render("corpus", {
        title: "Corpus",
        corpus: documents
      });
    } else {
      res.status(403).send("Access Denied");
    }
}

async function addDocumentToCorpus(req: express.Request, res: express.Response) {
  const permission = accessControl.can(req.user.role).readAny("corpus");
  if (permission.granted) {
      req.assert("title", "Document must have a title").notEmpty();
      req.assert("text", "Document must contain text").notEmpty();
      const errors = req.validationErrors();
      if (errors) {
        req.flash("errors", errors);
        res.redirect("back");
      }
      else {
        try {
          const title = await corpusService.addDocumentToCorpus(req.body.title, req.body.text);
          req.flash("success", {msg: `'${title}' added to corpus.`});
        } catch (error) {
          req.flash("errors", {msg: error});
        } finally {
          res.redirect("/corpus");
        }
      }
  }
  else {
    res.status(403).send("Access Denied");
  }
}

async function buildCorpus(req: express.Request, res: express.Response) {
  const permission = accessControl.can(req.user.role).deleteAny("corpus");
  if (permission.granted) {
    try {
      const titles = await corpusService.buildCorpus();
      req.flash("success", {msg: `Corpus built from ${titles.length} documents.`});
    } catch (error) {
      req.flash("errors", {msg: error});
    } finally {
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
    return addDocumentToCorpus(req, res);
}));
corpusAPI.post("/rebuildcorpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return buildCorpus(req, res);
}));

export default corpusAPI;
import * as express from "express";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl, connector } from "../app";
import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";
import { CorpusLemma, DocumentFrequency } from "../models/CorpusLemma";
import * as corpusService from "../services/corpus" ;
import * as passportConfig from "../config/passport";
import { asyncMiddleware } from "../utils/asyncMiddleware";

const corpusAPI = express.Router();

const displayCorpus = (req: express.Request, res: express.Response) => {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
      CorpusDocument.find((err, documents: Array<CorpusDocumentModel>) => {
        res.render("corpus", {
            title: "Corpus",
            corpus: documents
          });
      });
    } else {
      res.status(403).send("Access Denied");
    }
};

async function addDocumentToCorpus(req: express.Request, res: express.Response) {
  console.log("2");
  const permission = accessControl.can(req.user.role).readAny("corpus");
  if (permission.granted) {
      console.log("3");
      req.assert("title", "Document must have a title").notEmpty();
      req.assert("text", "Document must contain text").notEmpty();
      const errors = req.validationErrors();
      if (errors) {
        req.flash("errors", errors);
        res.redirect("back");
      }
      else {
        try {
          console.log("4");
          const title = await corpusService.addDocumentToCorpus(req.body.title, req.body.text);
          console.log("10");
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

corpusAPI.get("/corpus", passportConfig.isAuthenticated, displayCorpus);
corpusAPI.post("/corpus", passportConfig.isAuthenticated, asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log("1");
    return addDocumentToCorpus(req, res);
}));

export default corpusAPI;
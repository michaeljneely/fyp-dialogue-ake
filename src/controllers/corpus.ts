import * as async from "async";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import * as passport from "passport";
import { default as User, UserModel, AuthToken } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { IVerifyOptions } from "passport-local";
import { WriteError } from "mongodb";
const request = require("express-validator");
import { accessControl } from "../app";
import CorpusDocument, { CorpusDocumentModel } from "../models/CorpusDocument";

export let displayCorpus = (req: Request, res: Response) => {
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

export let addDocumentToCorpus = (req: Request, res: Response, next: NextFunction) => {
    const permission = accessControl.can(req.user.role).readAny("corpus");
    if (permission.granted) {
        req.assert("title", "Document must have a title").notEmpty();
        req.assert("text", "Document must contain text").notEmpty();
        const errors = req.validationErrors();
        if (errors) {
            req.flash("errors", errors);
            return res.redirect("/corpus");
        }
        const document = new CorpusDocument({title: req.body.title, text: req.body.text});
        document.save((err: WriteError) => {
            if (err) { return next(err); }
            req.flash("success", { msg: "Document has been added." });
          });
        res.redirect("/corpus");
    } else {
      res.status(403).send("Access Denied");
    }
};
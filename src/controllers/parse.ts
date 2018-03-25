import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
import * as express from "express";
import { Request, Response } from "express";
import { logger } from "../utils/logger";
import { annotators } from "../constants/annotators";
import { asyncMiddleware } from "../utils/asyncMiddleware";
import { parseDocument } from "../services/corenlp";

function index(req: Request, res: Response) {
    res.render("parse", {
        title: "Parse"
    });
}

async function parse(req: Request, res: Response) {
    try {
        const parsed = await parseDocument(req.body.text, false);
        res.json(parsed.document.toJSON());
    } catch (err) {
        return Promise.reject(err);
    }
}

const parseAPI = express.Router();

parseAPI.get("/parse", index);
parseAPI.post("/parse", asyncMiddleware(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return parse(req, res);
}));

export default parseAPI;

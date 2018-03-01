// import CoreNLP, { ConnectorServer, Pipeline, Properties } from "corenlp";
// import { logger } from "../utils/logger";
// import { Request, Response, NextFunction } from "express";
// const request = require("express-validator");
// import { connector } from "../app";
// import { default as Document } from "../models/Document";
// export let addToCorpus = (req: Request, res: Response, next: NextFunction) => {
//     req.assert("text", "Document must contain text").notEmpty();
//     const doc = new Document();
//     doc.text = req.body.text;
//     doc.save((err, document) => {
//         const DocumentID = document.id;
//         console.log(DocumentID);
//     });
//     /*
//     const pipeline = new Pipeline(props, "English", connector);
//     const sent = new CoreNLP.simple.Document(document);
//     const result = await pipeline.annotate(sent) as CoreNLP.simple.Document;
//     document.sentences().forEach((sentence: CoreNLP.simple.Sentence) => {
//         sentence.tokens().forEach((token: CoreNLP.simple.Token) => {
//             console.log("yo");
//         });
//     });
//     */
// };
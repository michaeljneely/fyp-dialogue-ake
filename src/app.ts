import * as sgMail from "@sendgrid/mail";
import { AccessControl } from "accesscontrol";
import * as bluebird from "bluebird";
import * as bodyParser from "body-parser";
import * as compression from "compression";  // compresses requests
import * as mongo from "connect-mongo";
import { ConnectorServer } from "corenlp";
import * as dotenv from "dotenv";
import * as express from "express";
import * as flash from "express-flash";
import * as session from "express-session";
import * as expressValidator from "express-validator";
import * as lusca from "lusca";
import * as mongoose from "mongoose";
import * as morgan from "morgan";
import * as passport from "passport";
import * as path from "path";
import { shim } from "promise.prototype.finally";
import * as redis from "redis";
import * as acl from "./config/acl";

// Security!!
// https://expressjs.com/en/advanced/best-practice-security.html
// https://nodesource.com/blog/nine-security-tips-to-keep-express-from-getting-pwned/
const helmet = require("helmet");

/* tslint:disable: no-console */

// Add 'finally' to promise chain
shim();

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({ path: ".env" });

// Load Logging
import { asyncMiddleware } from "./utils/asyncMiddleware";
import { logger, Stream } from "./utils/logger";

// Morgan Stream
const stream = new Stream();

// Initialize Mongo Session Store
const MongoStore = mongo(session);

// Routes
import analysisAPI from "./controllers/analyze";
import contactAPI from "./controllers/contact";
import corpusAPI from "./controllers/corpus";
import homeAPI from "./controllers/home";
import parseAPI from "./controllers/parse";
import summaryAPI from "./controllers/summarize";
import userAPI from "./controllers/user";

// API keys and Passport configuration
import * as passportConfig from "./config/passport";

// Create Express server
const app = express();

const client = redis.createClient();

const limiter = require("express-limiter")(app, client);


// Connect to CoreNLP Server
export const connector = new ConnectorServer({ dsn: process.env.CoreNLPAddress});

// Enforce Access Control
export const accessControl = new AccessControl(acl.grants);

// Mail Service
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_URI;
(<any>mongoose).Promise = bluebird;
mongoose.connect(mongoUrl).then(
  () => { /** ready to use. The `mongoose.connect()` promise resolves to undefined. */
console.log("connected to mongodb"); },
).catch(err => {
  console.log("MongoDB connection error. Please make sure MongoDB is running. " + err);
  process.exit();
});

// Express configuration

const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour

app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "pug");
app.use(helmet());
app.use(compression());
app.use(morgan("tiny", { stream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
        url: mongoUrl,
        autoReconnect: true
    })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
    req.path !== "/login" &&
    req.path !== "/signup" &&
    !req.path.match(/^\/auth/) &&
    !req.path.match(/\./)) {
    req.session.returnTo = req.path;
  } else if (req.user &&
    req.path == "/account") {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }));

/**
 * Define Limiters
 */

// Limit Contact Form (prevent email spam)
limiter({
    path: "/contact",
    method: "post",
    // Limit on IP
    lookup: ["connection.remoteAddress"],
    total: process.env.CONTACT_RATE_LIMIT_PER_HOUR,
    expire: 1000 * 60 * 60,
    // Whitelist admin
    whitelist: function (req: express.Request) {
        if (req.user && req.user.role && req.user.role === "admin") {
            logger.info(`admin bypass of /contact rate limit performed by ${req.user.id}.`);
            return true;
        }
        return false;
    },
    onRateLimited: function (req: express.Request, res: express.Response, next: express.NextFunction) {
        logger.info(`Contact Rate Limit Exceeded for user ${req.user.id}`);
        res.status(429).send("Contact Rate Limit Exceeded.");
    }
});

// Limit Parsing (large load on CoreNLP server)
limiter({
    path: "/parse",
    method: "post",
    // Limit on IP
    lookup: ["connection.remoteAddress"],
    total: process.env.PARSE_RATE_LIMIT_PER_HOUR,
    expire: 1000 * 60 * 60,
    // Whitelist admin
    whitelist: function (req: express.Request) {
        if (req.user && req.user.role && req.user.role === "admin") {
            logger.info(`admin bypass of /parse rate limit performed by ${req.user.id}.`);
            return true;
        }
        return false;
    },
    onRateLimited: function (req: express.Request, res: express.Response, next: express.NextFunction) {
        logger.info(`Parse Rate Limit Exceeded for user ${req.user.id}`);
        res.status(429).send("Parsing Rate Limit Exceeded.");
    }
});

// Limit Summarizing (large load on CoreNLP server, CPU, and DBpedia)
limiter({
    path: "/summarize",
    method: "post",
    // Limit on IP
    lookup: ["connection.remoteAddress"],
    total: process.env.SUMMARIZE_RATE_LIMIT_PER_HOUR,
    expire: 1000 * 60 * 60,
    // Whitelist admin
    whitelist: function (req: express.Request) {
        if (req.user && req.user.role && req.user.role === "admin") {
            logger.info(`admin bypass of /summarize rate limit performed by ${req.user.id}.`);
            return true;
        }
        return false;
    },
    onRateLimited: function (req: express.Request, res: express.Response, next: express.NextFunction) {
        logger.info(`Summarizing Rate Limit Exceeded for user ${req.user.id}`);
        res.status(429).send("Summarizing Rate Limit Exceeded.");
    }
});

// Limit Analysis (large load on CoreNLP server, CPU, and DBpedia)
limiter({
    path: "/analyze",
    method: "post",
    // Limit on IP
    lookup: ["connection.remoteAddress"],
    total: process.env.SUMMARIZE_RATE_LIMIT_PER_HOUR,
    expire: 1000 * 60 * 60,
    // Whitelist admin
    whitelist: function (req: express.Request) {
        if (req.user && req.user.role && req.user.role === "admin") {
            logger.info(`admin bypass of /analyze rate limit performed by ${req.user.id}.`);
            return true;
        }
        return false;
    },
    onRateLimited: function (req: express.Request, res: express.Response, next: express.NextFunction) {
        logger.info(`Analysis Rate Limit Exceeded for user ${req.user.id}`);
        res.status(429).send("Analysis Rate Limit Exceeded.");
    }
});

/**
 * Primary app routes.
 */
app.use(homeAPI);
app.use(corpusAPI);
app.use(userAPI);
app.use(contactAPI);
app.use(summaryAPI);
app.use(parseAPI);
app.use(analysisAPI);

module.exports = app;

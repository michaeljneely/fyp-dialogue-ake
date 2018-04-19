import * as express from "express";
import * as fs from "fs-extra";

/**
 * GET / - Render Home page.
 * @param req - Express Request
 * @param res - Express Response
 */
function index(req: express.Request, res: express.Response) {
    res.render("home", {
        title: "Home"
    });
}

// Create Routes
const homeAPI = express.Router();

/**
 * GET /
 * Render homepage
 * Authentication Required - False
 */
homeAPI.get("/", index);

// Expose Routes
export default homeAPI;

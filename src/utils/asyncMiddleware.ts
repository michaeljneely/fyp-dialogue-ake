import { Request, Response, NextFunction } from "express";

// https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
/**
 * Helper function that wraps express routes to handle rejected promises.
 * @param {Function} fn Function to wrap
 */
export const asyncMiddleware = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
};

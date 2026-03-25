import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response): void {
    res.status(404).json({
        error: {
            type: 'invalid_request_error',
            message: `Unrecognized request URL (${req.method}: ${req.path}). Please see https://stripe.com/docs/api for a list of valid API endpoints.`,
        },
    });
}

export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    console.error('[error]', err.stack ?? err.message);
    res.status(500).json({
        error: {
            type: 'api_error',
            message: 'An unexpected error occurred on the mock server.',
        },
    });
}

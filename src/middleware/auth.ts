import { Request, Response, NextFunction } from 'express';

export function validateApiKey(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({
            error: {
                type: 'authentication_error',
                code: 'missing_api_key',
                message:
                    'No API key provided. Please set the Authorization header: Bearer <key>',
            },
        });
        return;
    }

    const apiKey = auth.slice(7);
    const validKeys = (process.env.STRIPE_API_KEYS ?? 'sk_test_mock')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

    if (!validKeys.includes(apiKey)) {
        res.status(401).json({
            error: {
                type: 'authentication_error',
                code: 'api_key_invalid',
                message: 'Invalid API key provided.',
            },
        });
        return;
    }

    next();
}

import { rateLimit } from "express-rate-limit";

export const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10, // Limit each IP to 10 create account requests per `window` (here, per hour).
    standardHeaders: "draft-7", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: {
        message: "通報の回数が上限に達しました。しばらくしてから再度お試しください。"
    }
});

// General API Rate Limiter (Optional for future use)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false
});

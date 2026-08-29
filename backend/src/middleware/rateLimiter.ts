import rateLimit from 'express-rate-limit';

/**
 * Standard Global API Rate Limiter
 * Limits general API requests to 300 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true, // Return standard RateLimit headers (RateLimit-Limit, RateLimit-Remaining, etc.)
  legacyHeaders: false, // Disable X-RateLimit-* legacy headers
  message: {
    message: 'Too many requests from this IP address, please try again after 15 minutes.'
  }
});

/**
 * Strict Auth & Login Rate Limiter
 * Protects against credential stuffing, brute-force password guessing.
 * Max 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

/**
 * Tenant Onboarding / Provisioning Rate Limiter
 * Prevents automated workspace spam / database generation abuse.
 * Max 5 workspace provisions per hour per IP.
 */
export const provisionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many workspace creation requests from this network. Please try again in an hour.'
  }
});

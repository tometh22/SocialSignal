import { Request, Response, NextFunction } from "express";

// Input sanitization middleware to prevent XSS and injection attacks
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // SQL is always parameterized at the data-access layer. Treating ordinary prose
  // as SQL based on a single keyword (for example "seleccionar", "or", or a
  // semicolon in a meeting note) made the brief/minute flow unusable. Keep this
  // middleware focused on the small set of unambiguous payload-level attack
  // signatures and leave query safety to Drizzle's parameter binding.
  const dangerousPatterns = [
    /\bUNION(?:\s+ALL)?\s+SELECT\b/i,
    /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE)|ALTER\s+TABLE)\b/i,
    /(?:--|;|\|)\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b/i,
    /\b(?:OR|AND)\s+['"`]?\d+['"`]?\s*=\s*['"`]?\d+['"`]?/i,
    /\b(?:EXEC(?:UTE)?\s+|SP_|XP_)\w*/i,
  ];

  const containsSQLInjection = (input: string): boolean => {
    return dangerousPatterns.some(pattern => pattern.test(input));
  };

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Check for SQL injection patterns
      if (containsSQLInjection(value)) {
        console.log(`🚨 Input sanitization blocked value: "${value}"`);
        dangerousPatterns.forEach((pattern, index) => {
          if (pattern.test(value)) {
            console.log(`🚨 Matched pattern ${index}: ${pattern} in "${value}"`);
          }
        });
        throw new Error('Potentially dangerous SQL pattern detected');
      }
      
      // Remove potentially dangerous HTML tags and scripts
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // Keep line breaks in briefs/minutes
        .trim();
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({ 
      message: 'Invalid or potentially dangerous input detected',
      error: 'Input validation failed'
    });
  }
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
};

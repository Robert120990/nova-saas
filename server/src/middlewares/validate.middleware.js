/**
 * Universal Validation Middleware using Zod.
 * Validates request payload against a Zod schema and returns clean, Spanish error messages.
 */

/**
 * Creates an Express middleware for request body validation.
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
    if (!schema) return next();

    const result = schema.safeParse(req.body);
    if (!result.success) {
        const issues = result.error.issues || [];
        const formattedErrors = issues.map(issue => {
            const field = issue.path.join('.');
            return {
                field: field || 'general',
                message: issue.message
            };
        });

        // Use the first error message as primary toast message for frontend
        const primaryMessage = formattedErrors[0]?.message || 'Datos de formulario inválidos';

        return res.status(400).json({
            message: primaryMessage,
            errors: formattedErrors
        });
    }

    req.body = result.data;
    next();
};

module.exports = validate;

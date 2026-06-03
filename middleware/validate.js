const Joi = require('joi');

/**
 * Reusable validation middleware
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against
 * @param {string} property - The req property to validate (e.g. 'body', 'params', 'query')
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });

        if (error) {
            // Format Joi errors into a friendly message
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                details: errorMessage
            });
        }

        // Replace the request property with the strictly validated & sanitized value
        req[property] = value;
        next();
    };
};

module.exports = validate;

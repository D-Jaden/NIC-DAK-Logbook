const Joi = require('joi');

const pincodeSchema = Joi.object({
    pin: Joi.string()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            'string.length': 'Pincode must be exactly 6 digits',
            'string.pattern.base': 'Pincode must contain only numbers',
            'any.required': 'Pincode is required'
        })
});

const translateSchema = Joi.object({
    text: Joi.string()
        .min(1)
        .max(5000)
        .required()
        .messages({
            'string.min': 'Text to translate cannot be empty',
            'string.max': 'Text exceeds the 5000 character limit',
            'any.required': 'Text is required for translation'
        })
});

module.exports = {
    pincodeSchema,
    translateSchema
};

const Joi = require('joi');

const loginSchema = Joi.object({
    phone_no: Joi.string()
        .min(10)
        .max(15)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            'string.min': 'Phone number must be at least 10 digits',
            'string.max': 'Phone number cannot exceed 15 digits',
            'string.pattern.base': 'Phone number must contain only numbers',
            'any.required': 'Phone number is required'
        })
});

const registerSchema = Joi.object({
    first_name: Joi.string().min(3).max(50).required().messages({
        'string.min': 'First name must be at least 3 characters',
        'any.required': 'First name is required'
    }),
    last_name: Joi.string().min(3).max(50).required().messages({
        'string.min': 'Last name must be at least 3 characters',
        'any.required': 'Last name is required'
    }),
    phone_no: Joi.string()
        .min(10)
        .max(15)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            'string.min': 'Phone number must be at least 10 digits',
            'string.max': 'Phone number cannot exceed 15 digits',
            'string.pattern.base': 'Phone number must contain only numbers',
            'any.required': 'Phone number is required'
        }),
    agreed: Joi.boolean().valid(true).required().messages({
        'any.only': 'You must agree to the terms and conditions',
        'any.required': 'Terms agreement is required'
    })
});

module.exports = {
    loginSchema,
    registerSchema
};

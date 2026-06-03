const Joi = require('joi');

const rowSchema = Joi.object({
    serialNo: Joi.number().integer().allow(null, '').optional(),
    id: Joi.number().integer().optional(),
    
    // Dates
    letterDate: Joi.string().allow('', null).optional(),
    despatchDate: Joi.string().allow('', null).optional(),
    despatchOn: Joi.string().allow('', null).optional(),
    
    // Recipient Details
    toWhom: Joi.string().allow('', null).optional(),
    toWhomHindi: Joi.string().allow('', null).optional(),
    sentToName: Joi.string().allow('', null).optional(),
    sentToNameHi: Joi.string().allow('', null).optional(),
    
    // Addresses
    mainAddress: Joi.string().allow('', null).optional(),
    mainAddressHindi: Joi.string().allow('', null).optional(),
    sentToAddress: Joi.string().allow('', null).optional(),
    sentToAddressHi: Joi.string().allow('', null).optional(),
    
    // Zones and Places
    sentToZone: Joi.string().allow('', null).optional(),
    place: Joi.string().allow('', null).optional(),
    placeHindi: Joi.string().allow('', null).optional(),
    zone: Joi.string().allow('', null).optional(),
    
    // Content
    subject: Joi.string().allow('', null).optional(),
    subjectHindi: Joi.string().allow('', null).optional(),
    letterNo: Joi.string().allow('', null).optional(),
    letterNumber: Joi.string().allow('', null).optional(),
    
    // Sender
    engSentBy: Joi.string().allow('', null).optional(),
    hiSentBy: Joi.string().allow('', null).optional(),
    sentBy: Joi.string().allow('', null).optional(),
    sentByHindi: Joi.string().allow('', null).optional(),
    
    // Delivery methods
    deliveryMethod: Joi.string().allow('', null).optional(),
    modes: Joi.array().items(Joi.string()).optional(),
    
    // Metadata
    language: Joi.string().allow('', null).optional(),
    letterLanguage: Joi.string().allow('', null).optional(),
    status: Joi.string().valid('submitted', 'pending', 'draft').optional(),
    priority: Joi.string().allow('', null).optional(),
    
    // Copies
    copies: Joi.array().optional(),
    engCopySentTo: Joi.string().allow('', null).optional(),
    hiCopySentTo: Joi.string().allow('', null).optional()
}).unknown(true);

const saveDespatchSchema = Joi.object({
    data: Joi.alternatives().try(
        Joi.array().items(rowSchema),
        rowSchema
    ).optional(),
    changedRows: Joi.array().items(rowSchema).optional(),
    newRows: Joi.array().items(rowSchema).optional()
});

module.exports = { saveDespatchSchema };

const Joi = require('joi');

const rowSchema = Joi.object({
    serialNo: Joi.number().integer().allow(null, '').optional(),
    id: Joi.number().integer().optional(),

    // Dates
    letterDate: Joi.string().allow('', null).optional(),
    acquiredDate: Joi.string().allow('', null).optional(),
    acquiredOn: Joi.string().allow('', null).optional(),

    // Sender Details
    officeName: Joi.string().allow('', null).optional(),
    officeNameHindi: Joi.string().allow('', null).optional(),
    receivedFrom: Joi.string().allow('', null).optional(),
    receivedFromHindi: Joi.string().allow('', null).optional(),
    specificPerson: Joi.string().allow('', null).optional(),
    specificPersonHindi: Joi.string().allow('', null).optional(),

    // Address
    address: Joi.string().allow('', null).optional(),
    addressHindi: Joi.string().allow('', null).optional(),
    
    // Receiver Details
    receivedBy: Joi.string().allow('', null).optional(),
    receivedByHindi: Joi.string().allow('', null).optional(),

    // Content
    letterNo: Joi.string().allow('', null).optional(),
    letterNumber: Joi.string().allow('', null).optional(),
    subject: Joi.string().allow('', null).optional(),
    subjectHindi: Joi.string().allow('', null).optional(),

    // Metadata
    letterLanguage: Joi.string().allow('', null).optional(),
    zone: Joi.string().allow('', null).optional(),
    acquisitionMethod: Joi.string().allow('', null).optional(),
    modes: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid('submitted', 'pending', 'draft').optional(),
    priority: Joi.string().allow('', null).optional()
}).unknown(true);

const saveAcquiredSchema = Joi.object({
    data: Joi.alternatives().try(
        Joi.array().items(rowSchema),
        rowSchema
    ).optional(),
    changedRows: Joi.array().items(rowSchema).optional(),
    newRows: Joi.array().items(rowSchema).optional()
});

module.exports = { saveAcquiredSchema };

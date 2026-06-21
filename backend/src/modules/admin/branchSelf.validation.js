'use strict';

const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const idParam = Joi.object({ id: Joi.string().pattern(objectIdPattern).required() });
const branchIdsField = Joi.array().items(Joi.string().pattern(objectIdPattern)).single().default([]);

const originSchema = Joi.object({
  addressLine1: Joi.string().trim().allow(''),
  addressLine2: Joi.string().trim().allow(''),
  city: Joi.string().trim().allow(''),
  state: Joi.string().trim().allow(''),
  pincode: Joi.string().trim().allow(''),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
});

// Branch admin may edit only operational settings — not identity (name/code) or
// active state, which stay owner-only.
const updateMyBranch = {
  params: idParam,
  body: Joi.object({
    origin: originSchema,
    invoicePrefix: Joi.string().trim().allow(''),
    codEnabled: Joi.boolean(),
    reportRecipients: Joi.array().items(Joi.string().trim().email()),
    reportEnabled: Joi.boolean(),
  }).min(1),
};

const createMyStaff = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required().custom(joiSanitize),
    email: Joi.string().email().lowercase().trim().max(254).required(),
    phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).allow('').default('').messages({
      'string.pattern.base': 'Phone must be 10–15 digits',
    }),
    role: Joi.string().valid('staff', 'manager').required(),
    branchIds: branchIdsField,
  }).messages(joiXssMessages),
};

const setMyStaffActive = {
  params: idParam,
  body: Joi.object({ isActive: Joi.boolean().required() }),
};

const setMyStaffBranches = {
  params: idParam,
  body: Joi.object({ branchIds: branchIdsField }),
};

const staffIdParam = { params: idParam };

module.exports = { updateMyBranch, createMyStaff, setMyStaffActive, setMyStaffBranches, staffIdParam };

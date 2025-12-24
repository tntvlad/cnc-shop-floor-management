const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    next();
  };
};

// Validation schemas
const schemas = {
  login: Joi.object({
    employeeId: Joi.string().required(),
    password: Joi.string().required()
  }),
  
  createPart: Joi.object({
    name: Joi.string().required(),
    material: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    treatment: Joi.string().allow('', null),
    targetTime: Joi.number().integer().min(1).required(),
    orderPosition: Joi.number().integer().min(1).required()
  }),
  
  updatePart: Joi.object({
    name: Joi.string(),
    material: Joi.string(),
    quantity: Joi.number().integer().min(1),
    treatment: Joi.string().allow('', null),
    targetTime: Joi.number().integer().min(1),
    orderPosition: Joi.number().integer().min(1),
    completed: Joi.boolean(),
    locked: Joi.boolean()
  }).min(1),
  
  feedback: Joi.object({
    text: Joi.string().required().min(1).max(1000)
  }),
  
  completeTime: Joi.object({
    actualTime: Joi.number().integer().min(1).required()
  })
};

module.exports = { validateRequest, schemas };

const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    // Log what we received for debugging
    console.log('Validation - Request body:', JSON.stringify(req.body));
    
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      console.error('Validation failed:', errors);
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
    orderPosition: Joi.number().integer().min(1).required(),
    fileFolder: Joi.string().trim().max(500).allow('', null)
  }),
  
  updatePart: Joi.object({
    name: Joi.string(),
    material: Joi.string(),
    quantity: Joi.number().integer().min(1),
    treatment: Joi.string().allow('', null),
    targetTime: Joi.number().integer().min(1),
    orderPosition: Joi.number().integer().min(1),
    completed: Joi.boolean(),
    locked: Joi.boolean(),
    fileFolder: Joi.string().trim().max(500).allow('', null)
  }).min(1),
  
  feedback: Joi.object({
    text: Joi.string().required().min(1).max(1000)
  }),
  
  completeTime: Joi.object({
    actualTime: Joi.number().integer().min(1).required()
  }),

  updateFolder: Joi.object({
    folderPath: Joi.string().trim().max(500).allow('', null).required()
  }),

  // Allow numeric strings for flexibility with form inputs
  assignPart: Joi.object({
    userId: Joi.alternatives().try(
      Joi.number().integer(),
      Joi.string().pattern(/^\d+$/)
    ),
    userIds: Joi.array()
      .items(Joi.alternatives().try(
        Joi.number().integer(),
        Joi.string().pattern(/^\d+$/)
      ))
      .min(1)
  }).or('userId', 'userIds')
};

module.exports = { validateRequest, schemas };

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

  // Orders schemas
  createOrder: Joi.object({
    customer_name: Joi.string().required().max(255),
    customer_email: Joi.string().email().required(),
    customer_phone: Joi.string().max(20).allow('', null),
    order_date: Joi.date().required(),
    due_date: Joi.date().required(),
    notes: Joi.string().max(1000).allow('', null),
    parts: Joi.array().items(
      Joi.object({
        part_name: Joi.string().required(),
        quantity: Joi.number().integer().min(1),
        description: Joi.string().allow('', null),
        material_id: Joi.number().integer().allow(null)
      })
    ).allow(null)
  }),

  updateOrder: Joi.object({
    customer_name: Joi.string().max(255),
    customer_email: Joi.string().email(),
    customer_phone: Joi.string().max(20).allow('', null),
    due_date: Joi.date(),
    notes: Joi.string().max(1000).allow('', null)
  }).min(1),

  updateOrderStatus: Joi.object({
    status: Joi.string().valid('pending', 'in-progress', 'paused', 'completed', 'cancelled').required()
  }),

  // Materials schemas
  createMaterial: Joi.object({
    material_name: Joi.string().required().max(255),
    material_type: Joi.string().max(100),
    supplier_id: Joi.number().integer().allow(null),
    current_stock: Joi.number().min(0),
    reorder_level: Joi.number().min(0),
    unit: Joi.string().max(50).required(),
    cost_per_unit: Joi.number().min(0),
    notes: Joi.string().allow('', null)
  }),

  updateMaterialStock: Joi.object({
    current_stock: Joi.number().min(0),
    reorder_level: Joi.number().min(0),
    cost_per_unit: Joi.number().min(0)
  }).min(1),

  adjustMaterialStock: Joi.object({
    quantity: Joi.number().integer().min(1).required(),
    transaction_type: Joi.string().valid('add', 'remove', 'use').required(),
    notes: Joi.string().allow('', null)
  }),

  // Workflow schemas
  startWorkflowStage: Joi.object({
    stage: Joi.string().valid('cutting', 'programming', 'machining', 'qc', 'completed').required()
  }),

  completeWorkflowStage: Joi.object({
    notes: Joi.string().allow('', null)
  }),

  holdPart: Joi.object({
    reason: Joi.string().max(255)
  }),

  recordScrap: Joi.object({
    quantity_scrapped: Joi.number().integer().min(1).required(),
    reason: Joi.string().max(255),
    notes: Joi.string().allow('', null)
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

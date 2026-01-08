const db = require('../config/database');

// Get all customers (with search filter)
exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM contact_persons cp WHERE cp.customer_id = c.id) as contact_count
      FROM customers c
      ORDER BY c.company_name ASC
    `;
    const params = [];

    if (search) {
      query = `
        SELECT c.*,
          (SELECT COUNT(*) FROM contact_persons cp WHERE cp.customer_id = c.id) as contact_count
        FROM customers c
        WHERE c.company_name ILIKE $1 
           OR c.email ILIKE $1 
           OR c.phone ILIKE $1
           OR c.customer_id ILIKE $1
           OR c.cif ILIKE $1
        ORDER BY c.company_name ASC
      `;
      params.push(`%${search}%`);
    }

    const result = await db.query(query, params);
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single customer with contacts
exports.getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = result.rows[0];

    // Get contacts for this customer
    const contactsResult = await db.query(
      `SELECT * FROM contact_persons 
       WHERE customer_id = $1 
       ORDER BY contact_type, is_primary DESC, name`,
      [id]
    );
    customer.contacts = contactsResult.rows;

    // Compute effective delivery address
    customer.effective_delivery_address = customer.delivery_address || customer.headquarters_address || customer.address;

    res.json({ success: true, customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create customer
exports.createCustomer = async (req, res) => {
  try {
    const {
      company_name,
      customer_id,
      cif,
      reg_com,
      trade_register_number,
      headquarters_address,
      delivery_address,
      address,
      city,
      postal_code,
      country,
      email,
      phone,
      notes,
      processing_notes,
      delivery_notes,
      billing_notes,
      // Customer parameters (Phase 1)
      status,
      payment_terms,
      payment_history,
      discount_percentage,
      custom_terms_notes,
      approval_threshold,
      credit_limit
    } = req.body;

    if (!company_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Company name and email are required'
      });
    }

    const result = await db.query(
      `INSERT INTO customers (
        company_name, customer_id, cif, reg_com, trade_register_number,
        headquarters_address, delivery_address, address, city, postal_code, country,
        email, phone, notes, processing_notes, delivery_notes, billing_notes,
        status, payment_terms, payment_history, discount_percentage,
        custom_terms_notes, approval_threshold, credit_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        company_name, customer_id, cif, reg_com || trade_register_number, trade_register_number,
        headquarters_address, delivery_address, address, city, postal_code, country || 'Romania',
        email, phone, notes, processing_notes, delivery_notes, billing_notes,
        status || 'active', payment_terms || 'standard_credit', payment_history || 'new_customer',
        discount_percentage || 0, custom_terms_notes, approval_threshold, credit_limit
      ]
    );

    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      customer_id,
      cif,
      reg_com,
      trade_register_number,
      headquarters_address,
      delivery_address,
      address,
      city,
      postal_code,
      country,
      email,
      phone,
      notes,
      processing_notes,
      delivery_notes,
      billing_notes,
      // Customer parameters (Phase 1)
      status,
      payment_terms,
      payment_history,
      discount_percentage,
      custom_terms_notes,
      approval_threshold,
      credit_limit
    } = req.body;

    const result = await db.query(
      `UPDATE customers SET
        company_name = COALESCE($1, company_name),
        customer_id = $2,
        cif = COALESCE($3, cif),
        reg_com = COALESCE($4, reg_com),
        trade_register_number = COALESCE($5, trade_register_number),
        headquarters_address = COALESCE($6, headquarters_address),
        delivery_address = $7,
        address = COALESCE($8, address),
        city = COALESCE($9, city),
        postal_code = COALESCE($10, postal_code),
        country = COALESCE($11, country),
        email = COALESCE($12, email),
        phone = COALESCE($13, phone),
        notes = COALESCE($14, notes),
        processing_notes = COALESCE($15, processing_notes),
        delivery_notes = COALESCE($16, delivery_notes),
        billing_notes = COALESCE($17, billing_notes),
        status = COALESCE($18, status),
        payment_terms = COALESCE($19, payment_terms),
        payment_history = COALESCE($20, payment_history),
        discount_percentage = COALESCE($21, discount_percentage),
        custom_terms_notes = $22,
        approval_threshold = $23,
        credit_limit = $24,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $25
      RETURNING *`,
      [
        company_name, customer_id, cif, reg_com, trade_register_number,
        headquarters_address, delivery_address, address, city, postal_code, country,
        email, phone, notes, processing_notes, delivery_notes, billing_notes,
        status, payment_terms, payment_history, discount_percentage,
        custom_terms_notes, approval_threshold, credit_limit,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Batch import customers from CSV
exports.importCustomers = async (req, res) => {
  try {
    const { customers } = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No customers to import'
      });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      try {
        if (!c.company_name || !c.email) {
          errors.push(`Row ${i + 1}: Missing company_name or email`);
          continue;
        }

        const result = await db.query(
          `INSERT INTO customers (
            company_name, cif, reg_com, address, city, postal_code, country,
            contact_person, contact_phone, contact_email,
            email, phone,
            technical_contact_person, technical_phone, technical_email,
            processing_notes, delivery_notes, billing_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (email) DO UPDATE SET
            company_name = EXCLUDED.company_name
          RETURNING *`,
          [
            c.company_name, c.cif, c.reg_com, c.address, c.city, c.postal_code, c.country,
            c.contact_person, c.contact_phone, c.contact_email,
            c.email, c.phone,
            c.technical_contact_person, c.technical_phone, c.technical_email,
            c.processing_notes, c.delivery_notes, c.billing_notes
          ]
        );
        imported.push(result.rows[0]);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      failed: errors.length,
      errors,
      customers: imported
    });
  } catch (error) {
    console.error('Error importing customers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// CONTACT PERSONS CRUD
// ============================================================================

// Get contacts for a customer
exports.getCustomerContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    let query = `
      SELECT * FROM contact_persons 
      WHERE customer_id = $1
    `;
    const params = [id];

    if (type && ['invoice', 'order', 'technical'].includes(type)) {
      query += ` AND contact_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY contact_type, is_primary DESC, name`;

    const result = await db.query(query, params);

    // Group by type for easier frontend consumption
    const grouped = {
      invoice: result.rows.filter(c => c.contact_type === 'invoice'),
      order: result.rows.filter(c => c.contact_type === 'order'),
      technical: result.rows.filter(c => c.contact_type === 'technical')
    };

    res.json({ 
      success: true, 
      contacts: result.rows,
      grouped
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create contact person
exports.createContact = async (req, res) => {
  try {
    const { id } = req.params; // customer id
    const { contact_type, name, phone, email, is_primary, notes } = req.body;

    if (!name || !contact_type) {
      return res.status(400).json({
        success: false,
        message: 'Name and contact type are required'
      });
    }

    if (!['invoice', 'order', 'technical'].includes(contact_type)) {
      return res.status(400).json({
        success: false,
        message: 'Contact type must be invoice, order, or technical'
      });
    }

    // Verify customer exists
    const customerCheck = await db.query('SELECT id FROM customers WHERE id = $1', [id]);
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // If setting as primary, unset other primaries of same type
    if (is_primary) {
      await db.query(
        `UPDATE contact_persons SET is_primary = false 
         WHERE customer_id = $1 AND contact_type = $2`,
        [id, contact_type]
      );
    }

    const result = await db.query(
      `INSERT INTO contact_persons (customer_id, contact_type, name, phone, email, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, contact_type, name, phone, email, is_primary || false, notes]
    );

    res.json({ success: true, contact: result.rows[0] });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update contact person
exports.updateContact = async (req, res) => {
  try {
    const { id, contactId } = req.params;
    const { contact_type, name, phone, email, is_primary, notes } = req.body;

    // Verify contact belongs to customer
    const contactCheck = await db.query(
      'SELECT * FROM contact_persons WHERE id = $1 AND customer_id = $2',
      [contactId, id]
    );
    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    const currentType = contactCheck.rows[0].contact_type;
    const newType = contact_type || currentType;

    // If setting as primary, unset other primaries of same type
    if (is_primary) {
      await db.query(
        `UPDATE contact_persons SET is_primary = false 
         WHERE customer_id = $1 AND contact_type = $2 AND id != $3`,
        [id, newType, contactId]
      );
    }

    const result = await db.query(
      `UPDATE contact_persons SET
        contact_type = COALESCE($1, contact_type),
        name = COALESCE($2, name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        is_primary = COALESCE($5, is_primary),
        notes = COALESCE($6, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND customer_id = $8
      RETURNING *`,
      [contact_type, name, phone, email, is_primary, notes, contactId, id]
    );

    res.json({ success: true, contact: result.rows[0] });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete contact person
exports.deleteContact = async (req, res) => {
  try {
    const { id, contactId } = req.params;

    const result = await db.query(
      'DELETE FROM contact_persons WHERE id = $1 AND customer_id = $2 RETURNING id',
      [contactId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

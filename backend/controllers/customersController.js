const db = require('../config/database');

// Get all customers (with search filter)
exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers ORDER BY company_name ASC';
    const params = [];

    if (search) {
      query = `
        SELECT * FROM customers 
        WHERE company_name ILIKE $1 
           OR email ILIKE $1 
           OR phone ILIKE $1
           OR contact_person ILIKE $1
        ORDER BY company_name ASC
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

// Get single customer
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

    res.json({ success: true, customer: result.rows[0] });
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
      cif,
      reg_com,
      address,
      city,
      postal_code,
      country,
      contact_person,
      contact_phone,
      contact_email,
      email,
      phone,
      technical_contact_person,
      technical_phone,
      technical_email,
      processing_notes,
      delivery_notes,
      billing_notes
    } = req.body;

    if (!company_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Company name and email are required'
      });
    }

    const result = await db.query(
      `INSERT INTO customers (
        company_name, cif, reg_com, address, city, postal_code, country,
        contact_person, contact_phone, contact_email,
        email, phone,
        technical_contact_person, technical_phone, technical_email,
        processing_notes, delivery_notes, billing_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        company_name, cif, reg_com, address, city, postal_code, country,
        contact_person, contact_phone, contact_email,
        email, phone,
        technical_contact_person, technical_phone, technical_email,
        processing_notes, delivery_notes, billing_notes
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
      cif,
      reg_com,
      address,
      city,
      postal_code,
      country,
      contact_person,
      contact_phone,
      contact_email,
      email,
      phone,
      technical_contact_person,
      technical_phone,
      technical_email,
      processing_notes,
      delivery_notes,
      billing_notes
    } = req.body;

    const result = await db.query(
      `UPDATE customers SET
        company_name = COALESCE($1, company_name),
        cif = COALESCE($2, cif),
        reg_com = COALESCE($3, reg_com),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        postal_code = COALESCE($6, postal_code),
        country = COALESCE($7, country),
        contact_person = COALESCE($8, contact_person),
        contact_phone = COALESCE($9, contact_phone),
        contact_email = COALESCE($10, contact_email),
        email = COALESCE($11, email),
        phone = COALESCE($12, phone),
        technical_contact_person = COALESCE($13, technical_contact_person),
        technical_phone = COALESCE($14, technical_phone),
        technical_email = COALESCE($15, technical_email),
        processing_notes = COALESCE($16, processing_notes),
        delivery_notes = COALESCE($17, delivery_notes),
        billing_notes = COALESCE($18, billing_notes)
      WHERE id = $19
      RETURNING *`,
      [
        company_name, cif, reg_com, address, city, postal_code, country,
        contact_person, contact_phone, contact_email,
        email, phone,
        technical_contact_person, technical_phone, technical_email,
        processing_notes, delivery_notes, billing_notes,
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

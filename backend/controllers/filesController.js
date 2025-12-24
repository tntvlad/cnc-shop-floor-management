const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.dxf', '.nc', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DXF, and NC files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  }
});

// Upload file
exports.uploadFile = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { partId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const fileType = path.extname(req.file.originalname).substring(1).toUpperCase();

      const result = await pool.query(
        `INSERT INTO files (part_id, filename, file_type, file_path)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [partId, req.file.originalname, fileType, req.file.path]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Upload file error:', error);
      
      // Delete uploaded file if database insert fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
];

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(file.file_path, file.filename);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
};

// Get files for part
exports.getPartFiles = async (req, res) => {
  try {
    const { partId } = req.params;

    const result = await pool.query(
      'SELECT * FROM files WHERE part_id = $1 ORDER BY uploaded_at DESC',
      [partId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query('DELETE FROM files WHERE id = $1 RETURNING *', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Delete physical file
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

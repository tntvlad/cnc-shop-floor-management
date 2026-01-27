const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

const BROWSE_ROOT = path.resolve(process.env.FILE_BROWSE_ROOT || process.env.UPLOAD_DIR || './uploads');
const CLIENTS_ROOT = path.resolve(process.env.CLIENTS_ROOT_PATH || '/data/clients');

function ensureWithinRoot(targetPath, root = BROWSE_ROOT) {
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  const normalizedTarget = targetPath.endsWith(path.sep) ? targetPath : `${targetPath}${path.sep}`;
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('Path is outside the allowed root');
  }
}

// Create folder(s) recursively within clients root (for order parts)
exports.createFolder = async (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'Folder path is required' });
    }
    
    // Use CLIENTS_ROOT for order/part folders (same as customer folders)
    const resolved = path.resolve(CLIENTS_ROOT, folderPath);
    ensureWithinRoot(resolved, CLIENTS_ROOT);
    
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true, mode: 0o777 });
    }
    
    const relPath = path.relative(CLIENTS_ROOT, resolved).split(path.sep).join('/');
    
    res.json({ 
      success: true, 
      message: 'Folder created successfully',
      path: relPath,
      fullPath: resolved
    });
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create folder' });
  }
};

async function resolveUploadDir(req, res, next) {
  try {
    let targetDir = BROWSE_ROOT;

    if (req.params && req.params.partId) {
      const partRes = await pool.query('SELECT file_folder FROM parts WHERE id = $1', [req.params.partId]);
      if (partRes.rows.length === 0) {
        return res.status(404).json({ error: 'Part not found' });
      }

      const folder = partRes.rows[0].file_folder;
      if (folder) {
        const resolved = path.resolve(folder.startsWith(BROWSE_ROOT) ? folder : path.join(BROWSE_ROOT, folder));
        ensureWithinRoot(resolved);
        targetDir = resolved;
      }
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o777 });
    } else if (!fs.statSync(targetDir).isDirectory()) {
      return res.status(400).json({ error: 'Upload path is not a directory' });
    }

    req.uploadDir = targetDir;
    next();
  } catch (err) {
    console.error('Resolve upload dir error:', err);
    res.status(500).json({ error: 'Failed to resolve upload directory' });
  }
}

// Browse folders within allowed root
exports.browseFolders = async (req, res) => {
  try {
    const requested = req.query.path || '';
    const resolved = path.resolve(BROWSE_ROOT, requested);

    ensureWithinRoot(resolved);

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const mapped = entries.map((entry) => {
      const entryPath = path.join(resolved, entry.name);
      const relPath = path.relative(BROWSE_ROOT, entryPath).split(path.sep).join('/');
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : 'file',
        path: relPath,
        hasChildren: entry.isDirectory()
      };
    }).filter(e => e.type === 'dir');

    const relCurrent = path.relative(BROWSE_ROOT, resolved).split(path.sep).join('/');
    const parentRel = relCurrent ? path.posix.dirname(relCurrent) : null;

    res.json({
      root: BROWSE_ROOT,
      path: resolved,
      relativePath: relCurrent,
      parent: parentRel === '.' ? '' : parentRel,
      entries: mapped
    });
  } catch (err) {
    console.error('Browse folders error:', err);
    res.status(400).json({ error: err.message || 'Failed to browse folders' });
  }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = req.uploadDir || process.env.UPLOAD_DIR || './uploads';
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true, mode: 0o777 });
      } else if (!fs.statSync(uploadDir).isDirectory()) {
        return cb(new Error('Upload path is not a directory'));
      }
    } catch (err) {
      return cb(err);
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
  const allowedTypes = ['.pdf', '.dxf', '.nc', '.txt', '.step', '.stp', '.igs', '.iges', '.stl', '.3mf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Supported: PDF, DXF, NC, TXT, STEP, STP, IGS, IGES, STL, 3MF'));
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
  resolveUploadDir,
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

// Internal: perform sync for one part folder
async function performSyncForPart(partId, folderPath) {
  const dirPath = path.resolve(folderPath.startsWith(BROWSE_ROOT) ? folderPath : path.join(BROWSE_ROOT, folderPath));
  ensureWithinRoot(dirPath);

  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return { added: 0, files: [] };
  }

  const allowedExts = new Set(['.pdf', '.dxf', '.nc', '.txt', '.step', '.stp', '.sldprt', '.slddrw', '.sldasm', '.igs', '.iges', '.x_t', '.x_b', '.dwg', '.stl', '.3mf', '.gcode']);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let added = 0;
  const filesAdded = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExts.has(ext)) continue;

    const fullPath = path.join(dirPath, entry.name);
    // Skip broken files
    try {
      const st = fs.statSync(fullPath);
      if (!st.isFile()) continue;
    } catch (_) {
      continue;
    }

    // Check if already present for this part
    const existsRes = await pool.query(
      'SELECT id FROM files WHERE part_id = $1 AND file_path = $2',
      [partId, fullPath]
    );
    if (existsRes.rows.length > 0) continue;

    const fileType = ext.substring(1).toUpperCase();
    const insRes = await pool.query(
      `INSERT INTO files (part_id, filename, file_type, file_path)
       VALUES ($1, $2, $3, $4)
       RETURNING id, filename, file_type`,
      [partId, entry.name, fileType, fullPath]
    );
    added++;
    filesAdded.push(insRes.rows[0]);
  }

  return { added, files: filesAdded };
}

// Sync files from part's folder into DB without copying
exports.syncFromFolder = async (req, res) => {
  try {
    const { id } = req.params; // part id

    const partRes = await pool.query('SELECT file_folder FROM parts WHERE id = $1', [id]);
    if (partRes.rows.length === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }

    const folder = partRes.rows[0].file_folder;
    if (!folder) {
      return res.status(400).json({ error: 'Part does not have a folder assigned' });
    }

    const result = await performSyncForPart(id, folder);
    res.json({ message: 'Sync completed', ...result });
  } catch (error) {
    console.error('Sync from folder error:', error);
    res.status(500).json({ error: 'Failed to sync files from folder' });
  }
};

// Auto-sync all parts that have a folder
exports.syncAllPartsFromFolders = async () => {
  const partsRes = await pool.query('SELECT id, file_folder FROM parts WHERE file_folder IS NOT NULL');
  let totalAdded = 0;
  for (const row of partsRes.rows) {
    const folder = row.file_folder;
    if (!folder) continue;
    try {
      const { added } = await performSyncForPart(row.id, folder);
      totalAdded += added;
    } catch (err) {
      console.error(`Auto-sync error for part ${row.id}:`, err.message || err);
    }
  }
  if (totalAdded > 0) {
    console.log(`✓ Auto-sync: ${totalAdded} new file(s) indexed`);
  }
};

// Copy drawing file from source path (P: drive mapped) to target folder
exports.copyDrawingFile = async (req, res) => {
  try {
    const { sourcePath, targetFolder, filename } = req.body;
    
    if (!sourcePath || !targetFolder) {
      return res.status(400).json({ success: false, error: 'Source path and target folder are required' });
    }
    
    // Convert P:/1-Clienti/... path to /data/clients/...
    // Also handle file:/// prefix
    let cleanSource = sourcePath
      .replace(/^file:\/\/\//, '')  // Remove file:/// prefix
      .replace(/^P:\/1-Clienti\//i, '')  // Remove P:/1-Clienti/ prefix
      .replace(/^P:\\1-Clienti\\/i, '')  // Handle backslash version
      .replace(/%20/g, ' ');  // Decode URL spaces
    
    const sourceResolved = path.resolve(CLIENTS_ROOT, cleanSource);
    const targetResolved = path.resolve(CLIENTS_ROOT, targetFolder);
    
    // Security check - both paths must be within CLIENTS_ROOT
    ensureWithinRoot(sourceResolved, CLIENTS_ROOT);
    ensureWithinRoot(targetResolved, CLIENTS_ROOT);
    
    // Check if source file exists
    if (!fs.existsSync(sourceResolved)) {
      console.warn(`Source file not found: ${sourceResolved}`);
      return res.json({ 
        success: false, 
        error: 'Source file not found',
        sourcePath: sourceResolved
      });
    }
    
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetResolved)) {
      fs.mkdirSync(targetResolved, { recursive: true, mode: 0o777 });
    }
    
    // Determine filename
    const finalFilename = filename || path.basename(sourceResolved);
    const targetFile = path.join(targetResolved, finalFilename);
    
    // Copy the file
    fs.copyFileSync(sourceResolved, targetFile);
    
    console.log(`Copied drawing: ${sourceResolved} -> ${targetFile}`);
    
    res.json({ 
      success: true, 
      message: 'File copied successfully',
      source: sourceResolved,
      target: targetFile,
      filename: finalFilename
    });
  } catch (err) {
    console.error('Copy drawing file error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to copy file' });
  }
};

// Create folder and copy drawing file in one operation
exports.createFolderAndCopyDrawing = async (req, res) => {
  try {
    const { folderPath, drawingSourcePath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'Folder path is required' });
    }
    
    // Create folder
    const resolved = path.resolve(CLIENTS_ROOT, folderPath);
    ensureWithinRoot(resolved, CLIENTS_ROOT);
    
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true, mode: 0o777 });
    }
    
    const relPath = path.relative(CLIENTS_ROOT, resolved).split(path.sep).join('/');
    let copyResult = null;
    
    // Copy drawing if provided
    if (drawingSourcePath) {
      // Convert P:/1-Clienti/... path to /data/clients/...
      let cleanSource = drawingSourcePath
        .replace(/^file:\/\/\//, '')
        .replace(/^P:\/1-Clienti\//i, '')
        .replace(/^P:\\1-Clienti\\/i, '')
        .replace(/%20/g, ' ');
      
      const sourceResolved = path.resolve(CLIENTS_ROOT, cleanSource);
      
      try {
        ensureWithinRoot(sourceResolved, CLIENTS_ROOT);
        
        if (fs.existsSync(sourceResolved)) {
          const filename = path.basename(sourceResolved);
          const targetFile = path.join(resolved, filename);
          fs.copyFileSync(sourceResolved, targetFile);
          copyResult = { success: true, filename, targetFile };
          console.log(`Created folder and copied drawing: ${sourceResolved} -> ${targetFile}`);
        } else {
          copyResult = { success: false, error: 'Source file not found', path: sourceResolved };
          console.warn(`Drawing source not found: ${sourceResolved}`);
        }
      } catch (copyErr) {
        copyResult = { success: false, error: copyErr.message };
        console.error('Error copying drawing:', copyErr);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Folder created successfully',
      path: relPath,
      fullPath: resolved,
      drawingCopy: copyResult
    });
  } catch (err) {
    console.error('Create folder and copy error:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to create folder' });
  }
};

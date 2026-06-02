const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const hr = require('../controllers/hrController');

// Leave types reference
router.get('/leave-types', authMiddleware, hr.getLeaveTypes);

// Public holidays
router.get('/public-holidays',      authMiddleware, hr.getPublicHolidays);
router.post('/public-holidays',       authMiddleware, hr.createPublicHoliday);
router.put('/public-holidays/:id',    authMiddleware, hr.updatePublicHoliday);
router.delete('/public-holidays/:id', authMiddleware, hr.deletePublicHoliday);

// Leave balances
router.get('/balances',          authMiddleware, hr.getBalances);
router.get('/balances/me',       authMiddleware, hr.getMyBalance);
router.put('/balances/:userId',  authMiddleware, hr.updateBalance);

// Leave requests
router.get('/leaves',              authMiddleware, hr.getLeaves);
router.get('/leaves/me',           authMiddleware, hr.getMyLeaves);
router.post('/leaves',             authMiddleware, hr.createLeave);
router.put('/leaves/:id/approve',  authMiddleware, hr.approveLeave);
router.put('/leaves/:id/reject',   authMiddleware, hr.rejectLeave);
router.delete('/leaves/:id',       authMiddleware, hr.cancelLeave);

// Work hours
router.get('/hours',     authMiddleware, hr.getHours);
router.get('/hours/me',  authMiddleware, hr.getMyHours);
router.post('/hours',    authMiddleware, hr.logHours);
router.put('/hours/:id', authMiddleware, hr.updateHours);
router.delete('/hours/:id', authMiddleware, hr.deleteHours);

// Summary
router.get('/summary', authMiddleware, hr.getSummary);

// Export attendance sheet (EVIDENTA ORELOR DE MUNCA)
router.get('/export', authMiddleware, hr.exportAttendance);

module.exports = router;

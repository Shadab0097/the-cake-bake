const express = require('express');
const router = express.Router();
const upload = require('../../middleware/upload');
const uploadController = require('./upload.controller');
const { auth } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

router.use('/admin', auth, adminAuth);
router.post('/admin/image', upload.single('image'), uploadController.uploadAdminImage);
router.post('/admin/images', upload.array('images', 10), uploadController.uploadAdminImages);
router.delete('/admin/image', uploadController.deleteAdminImage);

module.exports = router;

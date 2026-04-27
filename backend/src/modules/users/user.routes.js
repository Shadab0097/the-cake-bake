const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const validate = require('../../middleware/validate');
const userValidation = require('./user.validation');
const { auth } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.use(auth); // All user routes require auth

router.get('/me', userController.getProfile);
router.get('/me/points', userController.getPoints);
router.put('/me', validate(userValidation.updateProfile), userController.updateProfile);
router.put('/me/avatar', upload.single('avatar'), userController.updateAvatar);

router.get('/me/addresses', userController.getAddresses);
router.post('/me/addresses', validate(userValidation.createAddress), userController.createAddress);
router.put('/me/addresses/:id', validate(userValidation.updateAddress), userController.updateAddress);
router.delete('/me/addresses/:id', userController.deleteAddress);
router.put('/me/addresses/:id/default', userController.setDefaultAddress);

module.exports = router;

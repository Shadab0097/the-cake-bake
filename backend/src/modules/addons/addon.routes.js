const express = require('express');
const router = express.Router();
const addonController = require('./addon.controller');

router.get('/', addonController.listAddOns);
router.get('/:category', addonController.getByCategory);

module.exports = router;

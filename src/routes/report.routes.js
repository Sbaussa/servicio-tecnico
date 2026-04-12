const router = require('express').Router();
const c = require('../controllers/report.controller');
const { auth } = require('../middlewares/auth.middleware');
router.use(auth);
router.get('/dashboard', c.dashboard);
router.get('/sales', c.salesReport);
router.get('/inventory', c.inventoryReport);
router.get('/repairs', c.repairsReport);
module.exports = router;

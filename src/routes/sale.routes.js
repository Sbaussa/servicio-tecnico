const router = require('express').Router();
const c = require('../controllers/sale.controller');
const { auth } = require('../middlewares/auth.middleware');
router.use(auth);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.patch('/:id/cancel', c.cancel);
module.exports = router;

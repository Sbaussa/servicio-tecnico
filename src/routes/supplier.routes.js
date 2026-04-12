const router = require('express').Router();
const c = require('../controllers/supplier.controller');
const { auth } = require('../middlewares/auth.middleware');
router.use(auth);
router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);
module.exports = router;

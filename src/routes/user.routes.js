const router = require('express').Router();
const c = require('../controllers/user.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
router.use(auth, requireRole('ADMIN', 'admin'));
router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.patch('/:id/password', c.changePassword);
module.exports = router;

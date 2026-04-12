const router = require('express').Router();
const c = require('../controllers/product.controller');
const { auth } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, 'prod_' + Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(auth);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', upload.single('image'), c.create);
router.put('/:id', upload.single('image'), c.update);
router.patch('/:id/stock', c.adjustStock);
router.delete('/:id', c.delete);
module.exports = router;

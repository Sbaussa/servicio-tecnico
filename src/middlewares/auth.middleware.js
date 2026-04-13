const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  const userRole = (req.user?.role || '').toLowerCase();
  const allowed = roles.map(r => r.toLowerCase());
  if (!allowed.includes(userRole)) {
    return res.status(403).json({ error: 'Sin permisos suficientes' });
  }
  next();
};

module.exports = { auth, requireRole };

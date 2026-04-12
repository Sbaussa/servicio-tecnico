require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (imágenes subidas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/auth',       require('./src/routes/auth.routes'));
app.use('/api/products',   require('./src/routes/product.routes'));
app.use('/api/categories', require('./src/routes/category.routes'));
app.use('/api/clients',    require('./src/routes/client.routes'));
app.use('/api/sales',      require('./src/routes/sale.routes'));
app.use('/api/repairs',    require('./src/routes/repair.routes'));
app.use('/api/suppliers',  require('./src/routes/supplier.routes'));
app.use('/api/users',      require('./src/routes/user.routes'));
app.use('/api/reports',    require('./src/routes/report.routes'));
app.use('/api/print',      require('./src/routes/print.routes'));
app.use('/api/public',     require('./src/routes/public.routes'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🔧 Servidor Servicio Técnico corriendo en puerto ${PORT}`);
});

module.exports = app;

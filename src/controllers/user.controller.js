const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true, role: true, active: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users.map(u => ({
      id: u.id, name: u.name, username: u.username,
      role: u.role.toLowerCase(), active: u.active, created_at: u.createdAt,
    })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, username, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const u = await prisma.user.create({
      data: { name, username, password: hashed, role: (role || 'vendedor').toUpperCase() },
    });
    res.status(201).json({ id: u.id });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, role, active } = req.body;
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        role: role ? role.toUpperCase() : undefined,
        active: active !== undefined ? Boolean(Number(active)) : undefined,
      },
    });
    res.json({ message: 'Usuario actualizado' });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { password: hashed },
    });
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
};

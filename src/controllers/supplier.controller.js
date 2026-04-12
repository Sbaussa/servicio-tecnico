const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    res.json(suppliers.map(s => ({
      id: s.id, name: s.name, contact_name: s.contactName,
      phone: s.phone, email: s.email, address: s.address,
      notes: s.notes, active: s.active, created_at: s.createdAt,
    })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, contact_name, phone, email, address, notes } = req.body;
    const s = await prisma.supplier.create({
      data: { name, contactName: contact_name || null, phone, email, address, notes },
    });
    res.status(201).json({ id: s.id });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, contact_name, phone, email, address, notes } = req.body;
    await prisma.supplier.update({
      where: { id: Number(req.params.id) },
      data: { name, contactName: contact_name || null, phone, email, address, notes },
    });
    res.json({ message: 'Proveedor actualizado' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.supplier.update({ where: { id: Number(req.params.id) }, data: { active: false } });
    res.json({ message: 'Proveedor desactivado' });
  } catch (err) { next(err); }
};

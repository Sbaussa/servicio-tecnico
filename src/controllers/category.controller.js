const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: { where: { active: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      createdAt: c.createdAt,
      product_count: c._count.products,
    })));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const cat = await prisma.category.create({
      data: { name: req.body.name, description: req.body.description || null },
    });
    res.status(201).json({ id: cat.id });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { name: req.body.name, description: req.body.description || null },
    });
    res.json({ message: 'Categoría actualizada' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Categoría eliminada' });
  } catch (err) { next(err); }
};

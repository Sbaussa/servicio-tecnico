const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAll = async (req, res, next) => {
  try {
    const { search, category_id, low_stock, active = '1' } = req.query;
    const where = { active: active === '1' };

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { code:  { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category_id) where.categoryId = Number(category_id);

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    let result = products;
    if (low_stock === '1') {
      result = products.filter(p => p.stock <= p.minStock);
    }

    res.json(result.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      category_id: p.categoryId,
      category_name: p.category?.name || null,
      supplier_id: p.supplierId,
      supplier_name: p.supplier?.name || null,
      purchase_price: Number(p.purchasePrice),
      sale_price: Number(p.salePrice),
      stock: p.stock,
      min_stock: p.minStock,
      unit: p.unit,
      brand: p.brand,
      model_compat: p.modelCompat,
      image_url: p.imageUrl,
      active: p.active,
      created_at: p.createdAt,
    })));
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
      id: p.id, code: p.code, name: p.name, description: p.description,
      category_id: p.categoryId, category_name: p.category?.name,
      supplier_id: p.supplierId, supplier_name: p.supplier?.name,
      purchase_price: Number(p.purchasePrice),
      sale_price: Number(p.salePrice),
      stock: p.stock, min_stock: p.minStock, unit: p.unit,
      brand: p.brand, model_compat: p.modelCompat, image_url: p.imageUrl,
      active: p.active,
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { code, name, description, category_id, supplier_id, purchase_price, sale_price, stock, min_stock, unit, brand, model_compat } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const stockNum = Number(stock) || 0;

    const product = await prisma.product.create({
      data: {
        code, name, description: description || null,
        categoryId: category_id ? Number(category_id) : null,
        supplierId: supplier_id ? Number(supplier_id) : null,
        purchasePrice: Number(purchase_price) || 0,
        salePrice: Number(sale_price),
        stock: stockNum,
        minStock: Number(min_stock) || 2,
        unit: unit || 'und',
        brand: brand || null,
        modelCompat: model_compat || null,
        imageUrl,
      },
    });

    if (stockNum > 0) {
      await prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          userId: req.user.id,
          type: 'ENTRADA',
          quantity: stockNum,
          stockBefore: 0,
          stockAfter: stockNum,
          reference: 'CREACION',
          notes: 'Stock inicial',
        },
      });
    }

    res.status(201).json({ id: product.id, message: 'Producto creado' });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { code, name, description, category_id, supplier_id, purchase_price, sale_price, min_stock, unit, brand, model_compat, active } = req.body;
    const data = {
      code, name, description: description || null,
      categoryId: category_id ? Number(category_id) : null,
      supplierId: supplier_id ? Number(supplier_id) : null,
      purchasePrice: purchase_price !== undefined ? Number(purchase_price) : undefined,
      salePrice: sale_price !== undefined ? Number(sale_price) : undefined,
      minStock: min_stock !== undefined ? Number(min_stock) : undefined,
      unit, brand: brand || null, modelCompat: model_compat || null,
    };
    if (active !== undefined) data.active = active === true || active === 1 || active === '1';
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    await prisma.product.update({ where: { id: Number(req.params.id) }, data });
    res.json({ message: 'Producto actualizado' });
  } catch (err) { next(err); }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, type, notes } = req.body;
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const stockBefore = product.stock;
    const qty = Number(quantity);
    const stockAfter = type === 'entrada' ? stockBefore + qty :
                       type === 'salida'  ? stockBefore - qty : qty;

    if (stockAfter < 0) return res.status(400).json({ error: 'Stock insuficiente' });

    await prisma.product.update({
      where: { id: product.id },
      data: { stock: stockAfter },
    });

    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        userId: req.user.id,
        type: type.toUpperCase(),
        quantity: qty,
        stockBefore,
        stockAfter,
        notes: notes || null,
      },
    });

    res.json({ message: 'Stock ajustado', stock_before: stockBefore, stock_after: stockAfter });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: { active: false },
    });
    res.json({ message: 'Producto desactivado' });
  } catch (err) { next(err); }
};
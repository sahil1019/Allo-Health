import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.idempotencyRecord.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({ data: { name: "Mumbai Central", location: "Mumbai, MH" } }),
    prisma.warehouse.create({ data: { name: "Delhi North", location: "Delhi, DL" } }),
    prisma.warehouse.create({ data: { name: "Bangalore South", location: "Bangalore, KA" } }),
  ]);

  const [mumbai, delhi, bangalore] = warehouses;

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        sku: "SONY-WH1000XM5-BLK",
        description: "Industry-leading noise cancelling wireless headphones with 30hr battery life.",
        price: 24990,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple AirPods Pro (2nd Gen)",
        sku: "APPLE-AIRPODS-PRO-2",
        description: "Active noise cancellation, Adaptive Transparency, and Personalized Spatial Audio.",
        price: 19900,
        imageUrl: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Kindle Paperwhite 11th Gen",
        sku: "AMZN-KPW-11G",
        description: "6.8\" display, adjustable warm light, waterproof, 3-month battery.",
        price: 11999,
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        sku: "KB-TKL-RED-SWITCH",
        description: "Tenkeyless 87-key, red linear switches, RGB backlit, USB-C.",
        price: 4499,
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Logitech MX Master 3S",
        sku: "LOGI-MXM3S-GRY",
        description: "Advanced wireless mouse, MagSpeed scroll wheel, 8K DPI sensor.",
        price: 8995,
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung 27\" 4K Monitor",
        sku: "SMNG-U27B4-BLK",
        description: "IPS panel, 60Hz, USB-C 65W charging, HDR10 certified.",
        price: 32999,
        imageUrl: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=400&q=80",
      },
    }),
  ]);

  // Stock — some with deliberately low stock to demo 409 easily
  const stockData = [
    // Sony Headphones
    { productId: products[0].id, warehouseId: mumbai.id, total: 5, reserved: 0 },
    { productId: products[0].id, warehouseId: delhi.id, total: 3, reserved: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, total: 1, reserved: 0 }, // LOW
    // AirPods Pro
    { productId: products[1].id, warehouseId: mumbai.id, total: 12, reserved: 0 },
    { productId: products[1].id, warehouseId: delhi.id, total: 8, reserved: 0 },
    // Kindle
    { productId: products[2].id, warehouseId: mumbai.id, total: 20, reserved: 0 },
    { productId: products[2].id, warehouseId: bangalore.id, total: 7, reserved: 0 },
    // Keyboard
    { productId: products[3].id, warehouseId: delhi.id, total: 2, reserved: 0 }, // LOW
    { productId: products[3].id, warehouseId: bangalore.id, total: 15, reserved: 0 },
    // MX Master 3S
    { productId: products[4].id, warehouseId: mumbai.id, total: 9, reserved: 0 },
    { productId: products[4].id, warehouseId: delhi.id, total: 4, reserved: 0 },
    { productId: products[4].id, warehouseId: bangalore.id, total: 6, reserved: 0 },
    // Samsung Monitor
    { productId: products[5].id, warehouseId: mumbai.id, total: 3, reserved: 0 },
    { productId: products[5].id, warehouseId: delhi.id, total: 1, reserved: 0 }, // LOW
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log(`✅ Created ${warehouses.length} warehouses`);
  console.log(`✅ Created ${products.length} products`);
  console.log(`✅ Created ${stockData.length} stock entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

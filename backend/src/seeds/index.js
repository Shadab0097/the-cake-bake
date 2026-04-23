const mongoose = require('mongoose');
const { env, validateEnv } = require('../config/env');
const connectDB = require('../config/db');
const logger = require('../middleware/logger');

// Models
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const AddOn = require('../models/AddOn');
const DeliverySlot = require('../models/DeliverySlot');
const DeliveryZone = require('../models/DeliveryZone');
const Coupon = require('../models/Coupon');
const Banner = require('../models/Banner');
const { generateSlug, toPaise } = require('../utils/helpers');

const seedAdmin = async () => {
  const existing = await User.findOne({ email: 'admin@cakebake.in' });
  if (existing) {
    logger.info('Admin user already exists');
    return existing;
  }

  const admin = await User.create({
    name: 'The Cake Bake Admin',
    email: 'admin@cakebake.in',
    phone: '9999999999',
    passwordHash: 'admin123456',
    role: 'superadmin',
    isVerified: true,
  });

  logger.info('✅ Admin user created (admin@cakebake.in / admin123456)');
  return admin;
};

const seedCategories = async () => {
  const count = await Category.countDocuments();
  if (count > 0) {
    logger.info('Categories already seeded');
    return Category.find().lean();
  }

  const categories = [
    { name: 'Birthday Cakes', description: 'Celebrate with our premium birthday cakes', sortOrder: 1 },
    { name: 'Anniversary Cakes', description: 'Make your anniversary special', sortOrder: 2 },
    { name: 'Wedding Cakes', description: 'Elegant wedding cakes for your big day', sortOrder: 3 },
    { name: 'Chocolate Cakes', description: 'Rich and decadent chocolate cakes', sortOrder: 4 },
    { name: 'Fruit Cakes', description: 'Fresh fruit-topped cakes', sortOrder: 5 },
    { name: 'Cheesecakes', description: 'Creamy, dreamy cheesecakes', sortOrder: 6 },
    { name: 'Designer Cakes', description: 'Custom designed premium cakes', sortOrder: 7 },
    { name: 'Photo Cakes', description: 'Personalized photo printed cakes', sortOrder: 8 },
    { name: 'Cupcakes', description: 'Delightful cupcake collections', sortOrder: 9 },
    { name: 'Tier Cakes', description: 'Multi-tier celebration cakes', sortOrder: 10 },
    { name: 'Eggless Cakes', description: 'Delicious 100% eggless cakes', sortOrder: 11 },
    { name: 'Kids Cakes', description: 'Fun themed cakes for kids', sortOrder: 12 },
  ];

  const created = await Category.insertMany(
    categories.map((c) => ({
      ...c,
      slug: generateSlug(c.name),
      isActive: true,
      image: '',
      seo: { title: c.name, description: c.description, keywords: '' },
    }))
  );

  logger.info(`✅ ${created.length} categories seeded`);
  return created;
};

const seedProducts = async (categories) => {
  const count = await Product.countDocuments();
  if (count > 0) {
    logger.info('Products already seeded');
    return;
  }

  const catMap = {};
  categories.forEach((c) => { catMap[c.name] = c._id; });

  const products = [
    {
      name: 'Belgian Chocolate Truffle Cake',
      shortDescription: 'Rich Belgian chocolate layers with truffle ganache',
      category: catMap['Chocolate Cakes'],
      tags: ['bestseller', 'trending'],
      occasions: ['birthday', 'anniversary', 'valentines'],
      flavors: ['chocolate', 'dark chocolate'],
      basePrice: toPaise(699),
      isEggless: false, hasEgglessOption: true, egglessExtraPrice: toPaise(50),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(699), compareAtPrice: toPaise(899) },
        { weight: '1 kg', price: toPaise(1199), compareAtPrice: toPaise(1499) },
        { weight: '1.5 kg', price: toPaise(1699), compareAtPrice: toPaise(1999) },
        { weight: '2 kg', price: toPaise(2199), compareAtPrice: toPaise(2599) },
      ],
    },
    {
      name: 'Classic Red Velvet Cake',
      shortDescription: 'Signature red velvet with cream cheese frosting',
      category: catMap['Birthday Cakes'],
      tags: ['bestseller', 'featured'],
      occasions: ['birthday', 'anniversary', 'valentines'],
      flavors: ['red velvet'],
      basePrice: toPaise(749),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(749), compareAtPrice: toPaise(949) },
        { weight: '1 kg', price: toPaise(1349), compareAtPrice: toPaise(1599) },
        { weight: '1.5 kg', price: toPaise(1899), compareAtPrice: toPaise(2199) },
        { weight: '2 kg', price: toPaise(2449), compareAtPrice: toPaise(2799) },
      ],
    },
    {
      name: 'Fresh Mango Delight Cake',
      shortDescription: 'Seasonal Alphonso mango cream cake',
      category: catMap['Fruit Cakes'],
      tags: ['trending', 'new'],
      occasions: ['birthday', 'thank_you'],
      flavors: ['mango', 'vanilla'],
      basePrice: toPaise(799),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore'],
      variants: [
        { weight: '0.5 kg', price: toPaise(799) },
        { weight: '1 kg', price: toPaise(1449) },
        { weight: '1.5 kg', price: toPaise(1999) },
      ],
    },
    {
      name: 'Blueberry Cheesecake',
      shortDescription: 'New York style cheesecake with fresh blueberry compote',
      category: catMap['Cheesecakes'],
      tags: ['featured'],
      occasions: ['birthday', 'valentines', 'thank_you'],
      flavors: ['blueberry', 'cheesecake'],
      basePrice: toPaise(899),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(899) },
        { weight: '1 kg', price: toPaise(1599) },
      ],
    },
    {
      name: 'Royal Butterscotch Cake',
      shortDescription: 'Crunchy butterscotch with praline topping',
      category: catMap['Birthday Cakes'],
      tags: ['bestseller'],
      occasions: ['birthday', 'congratulations'],
      flavors: ['butterscotch'],
      basePrice: toPaise(599),
      isEggless: true,
      isFeatured: false,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(599) },
        { weight: '1 kg', price: toPaise(1049) },
        { weight: '1.5 kg', price: toPaise(1549) },
        { weight: '2 kg', price: toPaise(1999) },
      ],
    },
    {
      name: 'Golden Anniversary Cake',
      shortDescription: 'Elegant 2-tier cake with gold accents',
      category: catMap['Anniversary Cakes'],
      tags: ['featured'],
      occasions: ['anniversary', 'wedding'],
      flavors: ['vanilla', 'chocolate', 'red velvet'],
      basePrice: toPaise(2499),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore'],
      variants: [
        { weight: '2 kg', price: toPaise(2499) },
        { weight: '3 kg', price: toPaise(3499) },
        { weight: '4 kg', price: toPaise(4499) },
      ],
    },
    {
      name: 'Pineapple Paradise Cake',
      shortDescription: 'Classic pineapple cake with glazed fruit topping',
      category: catMap['Fruit Cakes'],
      tags: [],
      occasions: ['birthday', 'farewell'],
      flavors: ['pineapple'],
      basePrice: toPaise(549),
      isEggless: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(549) },
        { weight: '1 kg', price: toPaise(949) },
        { weight: '1.5 kg', price: toPaise(1399) },
      ],
    },
    {
      name: 'Unicorn Theme Kids Cake',
      shortDescription: 'Colorful unicorn-themed fondant cake for kids',
      category: catMap['Kids Cakes'],
      tags: ['trending'],
      occasions: ['birthday', 'baby_shower'],
      flavors: ['vanilla', 'strawberry'],
      basePrice: toPaise(1299),
      isFeatured: true,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '1 kg', price: toPaise(1299) },
        { weight: '1.5 kg', price: toPaise(1799) },
        { weight: '2 kg', price: toPaise(2299) },
      ],
    },
    {
      name: 'Dark Fantasy Chocolate Overload',
      shortDescription: 'Triple chocolate layers with dark chocolate shavings',
      category: catMap['Chocolate Cakes'],
      tags: ['trending', 'new'],
      occasions: ['birthday', 'valentines'],
      flavors: ['dark chocolate'],
      basePrice: toPaise(849),
      isFeatured: false,
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(849) },
        { weight: '1 kg', price: toPaise(1499) },
        { weight: '1.5 kg', price: toPaise(2099) },
      ],
    },
    {
      name: 'White Forest Cake',
      shortDescription: 'Elegant white chocolate and cherry delight',
      category: catMap['Birthday Cakes'],
      tags: ['featured'],
      occasions: ['birthday', 'anniversary', 'christmas'],
      flavors: ['white chocolate', 'cherry'],
      basePrice: toPaise(699),
      hasEgglessOption: true, egglessExtraPrice: toPaise(50),
      cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad'],
      variants: [
        { weight: '0.5 kg', price: toPaise(699) },
        { weight: '1 kg', price: toPaise(1249) },
        { weight: '1.5 kg', price: toPaise(1799) },
        { weight: '2 kg', price: toPaise(2299) },
      ],
    },
  ];

  for (const productData of products) {
    const { variants, ...prodFields } = productData;
    prodFields.slug = generateSlug(prodFields.name);
    prodFields.isActive = true;
    prodFields.images = [{ url: '/uploads/placeholder.jpg', alt: prodFields.name, sortOrder: 0 }];
    prodFields.seo = { title: prodFields.name, description: prodFields.shortDescription, keywords: '' };

    const product = await Product.create(prodFields);

    if (variants && variants.length > 0) {
      await Variant.insertMany(
        variants.map((v, i) => ({
          ...v,
          product: product._id,
          sku: `${prodFields.slug}-${v.weight.replace(/\s/g, '')}`,
          stock: 999,
          isActive: true,
        }))
      );
    }
  }

  logger.info(`✅ ${products.length} products with variants seeded`);
};

const seedAddOns = async () => {
  const count = await AddOn.countDocuments();
  if (count > 0) {
    logger.info('Add-ons already seeded');
    return;
  }

  const addons = [
    { name: 'Number Candles (0-9)', price: toPaise(49), category: 'candles', sortOrder: 1 },
    { name: 'Musical Candle', price: toPaise(99), category: 'candles', sortOrder: 2 },
    { name: 'Sparkler Candles (Pack of 6)', price: toPaise(79), category: 'candles', sortOrder: 3 },
    { name: 'Red Roses Bouquet (6 stems)', price: toPaise(499), category: 'flowers', sortOrder: 1 },
    { name: 'Mixed Flower Arrangement', price: toPaise(699), category: 'flowers', sortOrder: 2 },
    { name: 'Birthday Greeting Card', price: toPaise(49), category: 'cards', sortOrder: 1 },
    { name: 'Premium Handwritten Card', price: toPaise(149), category: 'cards', sortOrder: 2 },
    { name: 'Balloon Bunch (5 pcs)', price: toPaise(199), category: 'balloons', sortOrder: 1 },
    { name: 'Foil Number Balloon', price: toPaise(149), category: 'balloons', sortOrder: 2 },
    { name: 'Happy Birthday Banner', price: toPaise(99), category: 'decorations', sortOrder: 1 },
  ];

  await AddOn.insertMany(
    addons.map((a) => ({
      ...a,
      slug: generateSlug(a.name),
      isActive: true,
      image: '',
      description: '',
    }))
  );

  logger.info(`✅ ${addons.length} add-ons seeded`);
};

const seedDeliverySlots = async () => {
  const count = await DeliverySlot.countDocuments();
  if (count > 0) {
    logger.info('Delivery slots already seeded');
    return;
  }

  const slots = [
    { label: 'Morning (9 AM - 12 PM)', startTime: '09:00', endTime: '12:00', maxOrders: 50, extraCharge: 0, sortOrder: 1 },
    { label: 'Afternoon (12 PM - 3 PM)', startTime: '12:00', endTime: '15:00', maxOrders: 50, extraCharge: 0, sortOrder: 2 },
    { label: 'Evening (3 PM - 6 PM)', startTime: '15:00', endTime: '18:00', maxOrders: 50, extraCharge: 0, sortOrder: 3 },
    { label: 'Night (6 PM - 9 PM)', startTime: '18:00', endTime: '21:00', maxOrders: 40, extraCharge: 0, sortOrder: 4 },
    { label: 'Late Night (9 PM - 12 AM)', startTime: '21:00', endTime: '00:00', maxOrders: 30, extraCharge: toPaise(100), sortOrder: 5 },
    { label: 'Midnight (12 AM - 1 AM)', startTime: '00:00', endTime: '01:00', maxOrders: 20, extraCharge: toPaise(200), sortOrder: 6 },
  ];

  await DeliverySlot.insertMany(slots.map((s) => ({ ...s, isActive: true, cities: [] })));
  logger.info(`✅ ${slots.length} delivery slots seeded`);
};

const seedDeliveryZones = async () => {
  const count = await DeliveryZone.countDocuments();
  if (count > 0) {
    logger.info('Delivery zones already seeded');
    return;
  }

  const zones = [
    { city: 'Mumbai', pincodes: [], deliveryCharge: toPaise(49), freeDeliveryAbove: toPaise(999), sameDayAvailable: true, sameDayCutoffTime: '14:00' },
    { city: 'Delhi', pincodes: [], deliveryCharge: toPaise(49), freeDeliveryAbove: toPaise(999), sameDayAvailable: true, sameDayCutoffTime: '14:00' },
    { city: 'Bangalore', pincodes: [], deliveryCharge: toPaise(59), freeDeliveryAbove: toPaise(999), sameDayAvailable: true, sameDayCutoffTime: '13:00' },
    { city: 'Hyderabad', pincodes: [], deliveryCharge: toPaise(49), freeDeliveryAbove: toPaise(999), sameDayAvailable: true, sameDayCutoffTime: '14:00' },
  ];

  await DeliveryZone.insertMany(zones.map((z) => ({ ...z, isActive: true })));
  logger.info(`✅ ${zones.length} delivery zones seeded`);
};

const seedCoupons = async () => {
  const count = await Coupon.countDocuments();
  if (count > 0) {
    logger.info('Coupons already seeded');
    return;
  }

  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const coupons = [
    { code: 'WELCOME20', type: 'percentage', value: 20, maxDiscount: toPaise(200), minOrderAmount: toPaise(499), description: '20% off on your first order', usageLimit: 0, perUserLimit: 1 },
    { code: 'CAKE10', type: 'percentage', value: 10, maxDiscount: toPaise(150), minOrderAmount: toPaise(699), description: '10% off on all cakes', usageLimit: 0, perUserLimit: 3 },
    { code: 'FLAT100', type: 'flat', value: toPaise(100), minOrderAmount: toPaise(999), description: 'Flat ₹100 off', usageLimit: 500, perUserLimit: 2 },
    { code: 'BIRTHDAY25', type: 'percentage', value: 25, maxDiscount: toPaise(500), minOrderAmount: toPaise(1499), description: '25% off on birthday cakes', usageLimit: 0, perUserLimit: 1 },
  ];

  await Coupon.insertMany(
    coupons.map((c) => ({
      ...c,
      validFrom: now,
      validUntil: nextYear,
      isActive: true,
      usageCount: 0,
      applicableCategories: [],
      applicableProducts: [],
    }))
  );

  logger.info(`✅ ${coupons.length} coupons seeded`);
};

const seedBanners = async () => {
  const count = await Banner.countDocuments();
  if (count > 0) {
    logger.info('Banners already seeded');
    return;
  }

  const banners = [
    { title: 'Freshly Baked, Delivered with Love', subtitle: 'Premium Cakes for Every Celebration', position: 'hero', sortOrder: 1 },
    { title: 'Midnight Delivery Available', subtitle: 'Surprise your loved ones at midnight', position: 'hero', sortOrder: 2 },
    { title: 'Flat 20% Off — First Order', subtitle: 'Use code WELCOME20', position: 'promo', sortOrder: 1 },
  ];

  await Banner.insertMany(
    banners.map((b) => ({
      ...b,
      image: { desktop: '', mobile: '' },
      link: '',
      isActive: true,
      validFrom: new Date(),
    }))
  );

  logger.info(`✅ ${banners.length} banners seeded`);
};

const runSeeds = async () => {
  try {
    validateEnv();
    await connectDB();

    logger.info('🌱 Starting database seeding...');

    await seedAdmin();
    const categories = await seedCategories();
    await seedProducts(categories);
    await seedAddOns();
    await seedDeliverySlots();
    await seedDeliveryZones();
    await seedCoupons();
    await seedBanners();

    logger.info('🌱 Database seeding completed!');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
};

runSeeds();

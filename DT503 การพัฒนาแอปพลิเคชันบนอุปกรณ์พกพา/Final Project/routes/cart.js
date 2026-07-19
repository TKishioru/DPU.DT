const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// โหลด JSON (ไม่ใช่ js)
const books = require("../data/books.json");

const CART_FILE = path.join(__dirname, "../data/cart.json");
const PURCHASE_FILE = path.join(__dirname, "../data/purchase.json");

/* -----------------------------
   Helper: Load / Save CART
----------------------------- */
function loadCartFile() {
  try {
    const data = JSON.parse(fs.readFileSync(CART_FILE, "utf8"));
    return typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function saveCartFile(data) {
  fs.writeFileSync(CART_FILE, JSON.stringify(data, null, 2));
}

/* -----------------------------
   Helper: Load / Save PURCHASE
----------------------------- */
function loadPurchaseData() {
  try {
    const data = JSON.parse(fs.readFileSync(PURCHASE_FILE, "utf8"));
    if (!Array.isArray(data.orders)) data.orders = [];
    return data;
  } catch {
    return { orders: [] };
  }
}

function savePurchaseData(data) {
  fs.writeFileSync(PURCHASE_FILE, JSON.stringify(data, null, 2));
}

/* -----------------------------
   Helper: user key
----------------------------- */
function getUserKey(req) {
  return req.session?.user?.fullname || "guest";
}

/* -----------------------------
   GET /cart
----------------------------- */
router.get("/", (req, res) => {
  const buyer = getUserKey(req);
  const user = req.session.user || null;
  const isLoggedIn = !!user;

  const cartData = loadCartFile();
  const userCart = cartData[buyer] || [];

  const cartList = userCart.map(item => {
    const book = books.find(b => b.id === item.id);
    if (!book) return null;

    const price = isLoggedIn ? Math.round(book.sellPrice * 0.9) : book.sellPrice;

    return {
      ...book,
      qty: item.qty,
      price,
      total: price * item.qty
    };
  }).filter(Boolean);

  res.render("cart", { cart: cartList, user });
});

/* -----------------------------
   GET /cart/count
----------------------------- */
router.get("/count", (req, res) => {
  const buyer = getUserKey(req);
  const cartData = loadCartFile();
  const cart = cartData[buyer] || [];
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  res.json({ count: totalQty });
});

/* -----------------------------
   POST /cart/add
----------------------------- */
router.post("/add", (req, res) => {
  const buyer = getUserKey(req);
  const id = parseInt(req.body.id);
  const qty = parseInt(req.body.qty) || 1;

  let cartData = loadCartFile();
  if (!cartData[buyer]) cartData[buyer] = [];

  const found = cartData[buyer].find(i => i.id === id);
  if (found) found.qty += qty;
  else cartData[buyer].push({ id, qty });

  saveCartFile(cartData);
  res.json({ message: "added", cart: cartData[buyer] });
});

/* -----------------------------
   POST /cart/update
----------------------------- */
router.post("/update", (req, res) => {
  const buyer = getUserKey(req);
  const id = parseInt(req.body.id);
  const qty = parseInt(req.body.qty);

  let cartData = loadCartFile();
  if (!cartData[buyer]) cartData[buyer] = [];

  const item = cartData[buyer].find(i => i.id === id);
  if (!item) return res.json({ message: "item not found" });

  item.qty = qty;
  saveCartFile(cartData);

  res.json({ message: "updated", cart: cartData[buyer] });
});

/* -----------------------------
   POST /cart/remove
----------------------------- */
router.post("/remove", (req, res) => {
  const buyer = getUserKey(req);
  const id = parseInt(req.body.id);

  let cartData = loadCartFile();
  cartData[buyer] = (cartData[buyer] || []).filter(i => i.id !== id);

  saveCartFile(cartData);
  res.json({ message: "removed", cart: cartData[buyer] });
});

/* -----------------------------
   GET /cart/checkout
----------------------------- */
router.get("/checkout", (req, res) => {
  const buyer = getUserKey(req);
  const user = req.session.user || null;
  const isLoggedIn = !!user;

  const cartData = loadCartFile();
  const userCart = cartData[buyer] || [];

  const cartList = userCart.map(item => {
    const book = books.find(b => b.id === item.id);
    if (!book) return null;

    const price = isLoggedIn ? Math.round(book.sellPrice * 0.9) : book.sellPrice;

    return {
      ...book,
      qty: item.qty,
      price,
      total: price * item.qty
    };
  }).filter(Boolean);

  const subtotal = cartList.reduce((sum, i) => sum + i.total, 0);

  res.render("checkout", {
    cart: cartList,
    subtotal,
    shipping: 50,
    discount: 0,
    grandTotal: subtotal + 50,
    user
  });
});

/* -----------------------------
   POST /cart/pay
----------------------------- */
router.post("/pay", (req, res) => {
  const buyer = getUserKey(req);
  const user = req.session.user || null;
  const isLoggedIn = !!user;

  let cartData = loadCartFile();
  let userCart = cartData[buyer] || [];
  if (userCart.length === 0) return res.json({ success: false, message: "Cart empty" });

  const form = req.body;

  let purchase = loadPurchaseData();

  const mappedItems = userCart.map(item => {
    const book = books.find(b => b.id === item.id);
    const price = isLoggedIn ? Math.round(book.sellPrice * 0.9) : book.sellPrice;

    return {
      id: item.id,
      qty: item.qty,
      price,
      total: price * item.qty
    };
  });

  const subtotal = mappedItems.reduce((sum, i) => sum + i.total, 0);

  const order = {
    orderId: "ORD-" + Date.now(),
    user: buyer,
    date: new Date().toISOString(),
    items: mappedItems,
    subtotal,
    shipping: 50,
    grandTotal: subtotal + 50,
    status: "PAID",
    shippingInfo: {
      fullname: form.fullname,
      address: form.address,
      postal: form.postal,
      phone: form.phone
    },
    paymentInfo: {
      cardName: form.cardName,
      cardExp: form.cardExp,
      last4: form.cardNumber ? form.cardNumber.slice(-4) : null
    }
  };

  purchase.orders.push(order);
  savePurchaseData(purchase);

  cartData[buyer] = [];
  saveCartFile(cartData);

  res.json({ success: true, orderId: order.orderId });
});

/* -----------------------------
   GET /cart/summary
----------------------------- */
router.get("/summary", (req, res) => {
  const orderId = req.query.orderId;

  const purchase = loadPurchaseData();
  const order = purchase.orders.find(o => o.orderId === orderId);

  if (!order) return res.send("Order not found");

  order.items = order.items.map(item => {
    const book = books.find(b => b.id === item.id);
    return {
      ...item,
      bookname: book?.bookname || "Unknown",
      imageURL: book?.imageURL || "/images/no_image.png"
    };
  });

  res.render("summary", { order, user: req.session.user || null });
});

module.exports = router;
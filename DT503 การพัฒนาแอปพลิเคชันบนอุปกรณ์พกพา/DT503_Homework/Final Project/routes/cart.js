const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const books = require("../data/books");

const CART_FILE = path.join(__dirname, "../data/cart.json");
const PURCHASE_FILE = path.join(__dirname, "../data/purchase.json");

/* -----------------------------
   helper: load/save cart
   รูปแบบที่ต้องการ:
   {
     "guest": [ {id, qty}, ... ],
     "Por":   [ {id, qty}, ... ]
   }
----------------------------- */
function loadCartFile() {
  try {
    const data = JSON.parse(fs.readFileSync(CART_FILE, "utf8"));
    // กันเคสไฟล์เพี้ยน
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data;
    }
    return {};
  } catch (e) {
    return {};
  }
}

function saveCartFile(data) {
  fs.writeFileSync(CART_FILE, JSON.stringify(data, null, 2));
}

/* -----------------------------
   helper: load/save purchase
   รูปแบบที่ต้องการ:
   {
     "orders": [
       {
         "orderId": "...",
         "user": "TK",
         ...
       }
     ]
   }
----------------------------- */
function loadPurchaseData() {
  try {
    const data = JSON.parse(fs.readFileSync(PURCHASE_FILE, "utf8"));
    if (!data.orders || !Array.isArray(data.orders)) {
      data.orders = [];
    }
    return data;
  } catch (e) {
    return { orders: [] };
  }
}

function savePurchaseData(data) {
  fs.writeFileSync(PURCHASE_FILE, JSON.stringify(data, null, 2));
}

/* -----------------------------
   helper: user key
   คืนค่า: fullname (string) หรือ "guest"
----------------------------- */
function getUserKey(req) {
  if (req.session && req.session.user && req.session.user.fullname) {
    return req.session.user.fullname; // ตรงกับ key ใน cart.json / purchase.json
  }
  return "guest";
}

/* -----------------------------
   GET /cart   (หน้า cart)
----------------------------- */
router.get("/", (req, res) => {
  const buyer = getUserKey(req);          // "guest" หรือ fullname
  const user = req.session.user || null;
  const isLoggedIn = !!user;

  const cartData = loadCartFile();
  const userCart = cartData[buyer] || [];

  const cartList = userCart
    .map((item) => {
      const book = books.find((b) => b.id === item.id);
      if (!book) return null;

      const price = isLoggedIn
        ? Math.round(book.sellPrice * 0.9)
        : book.sellPrice;

      return {
        ...book,
        qty: item.qty,
        price,
        total: price * item.qty,
      };
    })
    .filter(Boolean);

  res.render("cart", {
    cart: cartList,
    user,
  });
});

/* -----------------------------
   GET /cart/count (ใช้บน navbar)
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

  const found = cartData[buyer].find((i) => i.id === id);
  if (found) {
    found.qty += qty;
  } else {
    cartData[buyer].push({ id, qty });
  }

  saveCartFile(cartData);
  req.session.cart = cartData[buyer];

  res.json({ message: "added", cart: cartData[buyer] });
});

/* -----------------------------
   POST /cart/update
----------------------------- */
router.post("/update", (req, res) => {
  const buyer = getUserKey(req);
  let { id, qty } = req.body;
  id = parseInt(id);
  qty = parseInt(qty);

  let cartData = loadCartFile();
  if (!cartData[buyer]) cartData[buyer] = [];

  const item = cartData[buyer].find((i) => i.id === id);
  if (!item) {
    return res.json({ message: "item not found", cart: cartData[buyer] });
  }

  item.qty = qty;
  saveCartFile(cartData);
  req.session.cart = cartData[buyer];

  res.json({ message: "updated", cart: cartData[buyer] });
});

/* -----------------------------
   POST /cart/remove
----------------------------- */
router.post("/remove", (req, res) => {
  const buyer = getUserKey(req);
  const id = parseInt(req.body.id);

  let cartData = loadCartFile();
  if (!cartData[buyer]) cartData[buyer] = [];

  cartData[buyer] = cartData[buyer].filter((i) => i.id !== id);

  saveCartFile(cartData);
  req.session.cart = cartData[buyer];

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

  const cartList = userCart
    .map((item) => {
      const book = books.find((b) => b.id === item.id);
      if (!book) return null;

      const price = isLoggedIn
        ? Math.round(book.sellPrice * 0.9)
        : book.sellPrice;

      return {
        ...book,
        qty: item.qty,
        price,
        total: price * item.qty,
      };
    })
    .filter(Boolean);

  const subtotal = cartList.reduce((sum, item) => sum + item.total, 0);
  const shipping = 50;
  const discount = 0;
  const grandTotal = subtotal + shipping - discount;

  res.render("checkout", {
    cart: cartList,
    subtotal,
    shipping,
    discount,
    grandTotal,
    user,
  });
});

/* -----------------------------
   POST /cart/pay
   → บันทึกลง purchase.json แบบนี้:

   {
     "orders": [
       {
         "orderId": "...",
         "user": "TK",
         "date": "...",
         "items": [ {id, qty, price, total}, ... ],
         ...
       }
     ]
   }
----------------------------- */
router.post("/pay", (req, res) => {
  const buyer = getUserKey(req);
  const user = req.session.user || null;
  const isLoggedIn = !!user;

  // โหลด cart
  let cartData = loadCartFile();
  let userCart = cartData[buyer] || [];

  if (userCart.length === 0) {
    return res.json({ success: false, message: "Cart empty" });
  }

  // โหลดข้อมูลฟอร์ม
  const {
    fullname,
    address,
    postal,
    phone,
    cardNumber,
    cardName,
    cardExp,
    cardCvv,
  } = req.body;

  // โหลด purchase.json
  let purchase = loadPurchaseData(); // { orders: [...] }

  // คำนวณยอดรวม + map items พร้อมราคา
  const mappedItems = userCart.map((item) => {
    const book = books.find((b) => b.id === item.id);
    if (!book) return null;

    const price = isLoggedIn
      ? Math.round(book.sellPrice * 0.9)
      : book.sellPrice;

    return {
      id: item.id,
      qty: item.qty,
      price,
      total: price * item.qty,
    };
  }).filter(Boolean);

  const subtotal = mappedItems.reduce((sum, i) => sum + i.total, 0);
  const shipping = 50;
  const grandTotal = subtotal + shipping;

  const orderId = "ORD-" + Date.now();

  // บันทึก order
  purchase.orders.push({
    orderId,
    user: buyer,                 // ตรงกับตัวอย่าง purchase.json
    date: new Date().toISOString(),
    items: mappedItems,
    subtotal,
    shipping,
    grandTotal,
    status: "PAID",
    shippingInfo: {
      fullname,
      address,
      postal,
      phone,
    },
    paymentInfo: {
      cardName,
      cardExp,
      last4: cardNumber ? cardNumber.slice(-4) : null,
    },
  });

  savePurchaseData(purchase);

  // ล้างตะกร้า
  cartData[buyer] = [];
  saveCartFile(cartData);

  res.json({ success: true, orderId });
});

/* -----------------------------
   GET /cart/summary?orderId=...
----------------------------- */
router.get("/summary", (req, res) => {
  const user = req.session.user || null;
  const orderId = req.query.orderId;

  const purchase = loadPurchaseData();
  const order = purchase.orders.find((o) => o.orderId === orderId);

  if (!order) {
    return res.send("Order not found");
  }

  // เติมชื่อหนังสือ / รูป จาก books (ราคาใช้จากไฟล์ purchase)
  const mappedItems = order.items.map((item) => {
    const book = books.find((b) => b.id === item.id);

    return {
      ...item,
      bookname: book ? book.bookname : `Book #${item.id}`,
      imageURL: book ? book.imageURL : "",
    };
  });

  order.items = mappedItems;
  // subtotal / grandTotal ใช้จากไฟล์ได้เลย ถ้าอยากให้ตรงเป๊ะ
  // ถ้าจะคำนวณใหม่ก็ทำจาก mappedItems ได้เหมือนกัน

  res.render("summary", {
    order,
    user,
  });
});

module.exports = router;
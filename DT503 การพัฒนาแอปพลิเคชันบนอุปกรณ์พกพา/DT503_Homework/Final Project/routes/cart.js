const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const books = require("../data/books");

const CART_FILE = path.join(__dirname, "../data/cart.json");
const PURCHASE_FILE = path.join(__dirname, "../data/purchase.json");

function loadPurchaseData() {
    try {
        return JSON.parse(fs.readFileSync(PURCHASE_FILE, "utf8"));
    } catch (err) {
        return { orders: [] };
    }
}

function savePurchaseData(data) {
    fs.writeFileSync(PURCHASE_FILE, JSON.stringify(data, null, 2));
}

// โหลดจากไฟล์
function loadCartFile() {
    try {
        return JSON.parse(fs.readFileSync(CART_FILE, "utf8"));
    } catch {
        return [];
    }
}

// เขียนไฟล์
function saveCartFile(data) {
    fs.writeFileSync(CART_FILE, JSON.stringify(data, null, 2));
}

// หน้าตะกร้า
router.get("/", (req, res) => {
    const cartData = loadCartFile();

    const cartList = cartData.map(item => {
        const book = books.find(b => b.id === item.id);
        return {
            ...book,
            qty: item.qty,
            total: Math.round(book.sellPrice * 0.9) * item.qty
        };
    });

    res.render("cart", { cart: cartList });
});

// API: จำนวนสินค้าในตะกร้า (สำหรับ navbar)
router.get("/count", (req, res) => {
    const cart = req.session.cart || [];
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    res.json({ count: totalQty });
});

// API: เพิ่มสินค้าลงตะกร้า
router.post("/add", (req, res) => {
    const id = parseInt(req.body.id);
    const qty = parseInt(req.body.qty) || 1;

    if (!req.session.cart) req.session.cart = [];

    let found = req.session.cart.find(i => i.id === id);
    if (found) {
        found.qty += qty;
    } else {
        req.session.cart.push({ id, qty });
    }

    saveCartFile(req.session.cart);

    res.json({ message: "added", cart: req.session.cart });
});

// API: อัปเดตจำนวนสินค้า (+1 หรือ -1)
router.post("/update", (req, res) => {
    let { id, qty } = req.body;
    id = parseInt(id);

    let cart = loadCartFile();

    const item = cart.find(i => i.id === id);

    if (!item) {
        return res.json({ message: "item not found", cart });
    }

    item.qty = qty;

    saveCartFile(cart);
    req.session.cart = cart;

    res.json({ message: "updated", cart });
});



// API: ลบสินค้าออกจากตะกร้า
router.post("/remove", (req, res) => {
    const id = parseInt(req.body.id);
    console.log("Removing item with ID:", id);
    
    let cart = loadCartFile();
    
    cart = cart.filter(i => i.id !== id);

    saveCartFile(cart);
    req.session.cart = cart;

    res.json({ message: "removed", cart });
});


module.exports = router;
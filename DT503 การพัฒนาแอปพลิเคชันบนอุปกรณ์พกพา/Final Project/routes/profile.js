const express = require("express");
const fs = require("fs");
const router = express.Router();

const books = require("../data/books.json");
const purchaseFile = "./data/purchase.json";

router.get("/", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let purchase = JSON.parse(fs.readFileSync(purchaseFile, "utf8"));
  if (!purchase.orders) purchase.orders = [];

  // ดึงเฉพาะ order ของ user
  let userOrders = purchase.orders.filter(o => o.user === user.fullname);

  // เติมข้อมูลหนังสือ + format วันที่
  userOrders = userOrders.map(order => {
    order.items = order.items.map(item => {
      const book = books.find(b => b.id === item.id);

      return {
        ...item,
        bookname: book?.bookname || "Unknown",
        imageURL: book?.imageURL || "/images/no_image.png"
      };
    });

    order.dateFormatted = new Date(order.date).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return order;
  });

  // เรียง order: ใหม่ → เก่า
  userOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.render("profile", { user, orders: userOrders });
});

module.exports = router;
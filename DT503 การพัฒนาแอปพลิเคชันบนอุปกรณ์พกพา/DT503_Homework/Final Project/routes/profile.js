const express = require("express");
const fs = require("fs");
const router = express.Router();
const purchaseFile = "./data/purchase.json";
const books = require("../data/books");

router.get("/", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let purchase = JSON.parse(fs.readFileSync(purchaseFile, "utf8"));
  if (!purchase.orders) purchase.orders = [];

  // ดึงเฉพาะ order ของ user
  let userOrders = purchase.orders.filter((o) => o.user === user.fullname);

  // เติมข้อมูลหนังสือในแต่ละ order
  userOrders = userOrders.map((order) => {
    order.items = order.items.map((item) => {
      const book = books.find((b) => b.id === item.id);

      return {
        ...item,
        bookname: book?.bookname || "Unknown book",
        imageURL: book?.imageURL || "/images/no_image.png",
        price: item.price, // ใช้ราคาที่เคยถูกบันทึก
        total: item.total,
      };
    });

    // จัดรูปแบบวันที่
    order.dateFormatted = new Date(order.date).toLocaleString("en-US", {
      year: "numeric",
      month: "long", // December
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return order;
  });
  // เรียง order จากใหม่ → เก่า
  userOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.render("profile", {
    user,
    orders: userOrders,
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();

const booksApi = require("./api_books");
const usersApi = require("./api_users");
const webBooks = require("./web_books");
const cartRouter = require("./cart");
const profile =require("./profile");

// API
router.use("/api/users", usersApi);
router.use("/api/books", booksApi);

// WEB PAGES
router.use("/profile", profile);
router.use("/cart", cartRouter);      // cart ก่อน
router.use("/", webBooks);         // หน้าเว็บอื่นตามหลัง

router.get("/login", (req, res) => {
    res.render("login", { error: null });
});

router.get("/register", (req, res) => {
    res.render("register", { error: null });
});

// ฟอร์มจากหน้า UI จะยิงมาที่นี่ แล้วเราจะ forward ไป API
router.post("/register", async (req, res) => {
    const response = await fetch("http://localhost:2000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
    });

    const result = await response.json();

    if (result.message === "Username already exists") {
        return res.render("register", { error: "⚠ ชื่อนี้ถูกใช้แล้ว" });
    }

    res.redirect("/login");
});

router.post("/login", async (req, res) => {
    const response = await fetch("http://localhost:2000/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
    });

    const result = await response.json();

    if (result.message !== "Login successful") {
        return res.render("login", { error: "⚠ Username หรือ Password ไม่ถูกต้อง" });
    }

    res.redirect("/");
});

router.get("/logout", (req, res) => {
    // ทำลาย session
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return res.redirect("/");
        }

        // เคลียร์ cookie (ถ้ามี)
        res.clearCookie("connect.sid");

        // กลับหน้าแรก
        res.redirect("/");
    });
});

module.exports = router;

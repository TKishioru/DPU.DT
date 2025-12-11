const express = require("express");
const router = express.Router();

const apiUsers = require("./api_users");
const apiBooks = require("./api_books");
const webBooks = require("./web_books");
const cartRouter = require("./cart");
const profileRouter = require("./profile");

// API
router.use("/api/users", apiUsers);
router.use("/api/books", apiBooks);

// WEB Pages
router.use("/cart", cartRouter);
router.use("/profile", profileRouter);
router.use("/", webBooks);

// Login Page
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Register Page
router.get("/register", (req, res) => {
  res.render("register", { error: null });
});

// Register
router.post("/register", async (req, res) => {
  const response = await fetch("http://localhost:2000/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });

  const result = await response.json();

  if (result.message !== "User registered") {
    return res.render("register", { error: "Email already exists" });
  }

  res.redirect("/login");
});

// Login
router.post("/login", async (req, res) => {
  const response = await fetch("http://localhost:2000/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });

  const result = await response.json();

  if (result.message !== "Login successful") {
    return res.render("login", { error: "Invalid email or password" });
  }

  // ⭐ Set session user
  req.session.user = {
    email: result.user.email,
    fullname: result.user.fullname,
    username: result.user.username,
  };

  res.redirect("/");
});

// Logout
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
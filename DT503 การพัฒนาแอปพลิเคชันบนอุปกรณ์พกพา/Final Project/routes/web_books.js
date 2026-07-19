const express = require("express");
const router = express.Router();
const books = require("../data/books.json");

router.get("/", (req, res) => {
  res.render("index", { books });
});

router.get("/books/:id", (req, res) => {
  const book = books.find((b) => b.id === parseInt(req.params.id));
  if (!book) return res.send("Not found");

  res.render("book_detail", { book, books });
});

module.exports = router;
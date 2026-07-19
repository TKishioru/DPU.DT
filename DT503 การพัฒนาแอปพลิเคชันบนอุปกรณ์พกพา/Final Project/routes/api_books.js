const express = require("express");
const router = express.Router();
const books = require("../data/books.json");

router.get("/", (req, res) => res.json(books));
router.get("/:id", (req, res) => {
  const b = books.find((bk) => bk.id === parseInt(req.params.id));
  if (!b) return res.status(404).json({ message: "Not found" });
  res.json(b);
});

module.exports = router;
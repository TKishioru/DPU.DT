const express = require("express");
const session = require("express-session");
const app = express();
const path = require("path");
const mainRouter = require("./routes/index");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session
app.use(
  session({
    secret: "NJTK_SECRET",
    resave: false,
    saveUninitialized: true,
  })
);

// ทำให้ทุกหน้าเข้าถึง req.session.user ผ่าน res.locals.user
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// View Engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use("/", mainRouter);

const port = 2000;
app.listen(port, () => console.log("Server running on port " + port));
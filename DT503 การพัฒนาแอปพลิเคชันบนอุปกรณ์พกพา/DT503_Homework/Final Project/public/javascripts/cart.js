async function updateCartCountFromSession() {
    try {
        const res = await fetch("/cart/count");
        const data = await res.json();
        const badge = document.getElementById("cart-count");
        if (badge) badge.textContent = data.count;
    } catch (err) {
        console.error("Cannot load cart count:", err);
    }
}

// ✓ ปรับจำนวนบนหน้า detail
function adjustQty(amount) {
  const qtyEl = document.getElementById("qtyDisplay");
  let qty = parseInt(qtyEl.textContent) + amount;

  if (qty < 1) qty = 1;
  qtyEl.textContent = qty;
}

async function addToCartSession(bookId, qty = 1) {
    await fetch("/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookId, qty })
    });

    updateCartCountFromSession();
}

document.addEventListener("DOMContentLoaded", updateCartCountFromSession);

function checkout() {
    fetch("/cart/checkout", { method: "POST" })
        .then(res => res.json())
        .then(data => {
            alert("สั่งซื้อสำเร็จ! Order ID: " + data.orderId);
            location.href = "/checkout";  // กลับหน้าหลัก หรือหน้าใบสั่งซื้อก็ได้
        })
        .catch(err => console.error(err));
}

/*
console.log("cart.js loaded");

// โหลด cart จาก localStorage
function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || {};
}

// บันทึก cart
function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// อัปเดตจำนวนใน navbar
function updateCartCount() {
  const cart = getCart();
  let totalQty = 0;
  Object.values(cart).forEach((qty) => (totalQty += qty));

  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.textContent = totalQty;
  }
}

// เพิ่มสินค้าแบบเลือกจำนวน
function addToCart(bookId) {
  const cart = getCart();
  const qty = parseInt(document.getElementById("qtyDisplay").textContent);

  cart[bookId] = (cart[bookId] || 0) + qty;

  saveCart(cart);
  updateCartCount();

  alert("เพิ่มหนังสือลงตะกร้าแล้ว!");
}

// ฟังก์ชัน Add to Cart (อัปเดตจากเดิมให้รับจำนวนไปด้วย)
function addToCartOnec(btn, bookId) {
  const span = btn.querySelector("span");
  const icon = btn.querySelector("i");
  const cart = getCart();
  const qty = 1;
  const originalContent = "Add to Cart";

  // เปลี่ยนปุ่มเป็นสถานะสำเร็จ
  span.innerText = `Added ${qty} item(s)`; // โชว์จำนวนที่หยิบใส่
  icon.className = "fa-solid fa-check relative z-10";
  btn.classList.remove("bg-njtk-sage");
  btn.classList.add("bg-njtk-dark"); // เปลี่ยนสีปุ่มชั่วคราว

  // อัปเดต cart ใน localStorage
  cart[bookId] = (cart[bookId] || 0) + qty;

  saveCart(cart);
  updateCartCount();

  alert("เพิ่มหนังสือลงตะกร้าแล้ว!");

  // คืนค่าเดิมหลังจาก 2 วินาที
  setTimeout(() => {
    span.innerText = originalContent;
    icon.className =
      "fa-solid fa-arrow-right relative z-10 group-hover:translate-x-1 transition-transform";
    btn.classList.add("bg-njtk-sage");
    btn.classList.remove("bg-njtk-dark");
  }, 2000);
}



// ✓ Sync localStorage → server
async function syncCartToServer() {
  const cart = getCart();

  await fetch("/cart/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart })
  });
}

// โหลดจำนวนในตะกร้าเมื่อเปิดหน้า
document.addEventListener("DOMContentLoaded", async () => {
  updateCartCount();

  // ถ้าอยู่ในหน้าตะกร้า → sync
  if (window.location.pathname === "/cart") {
    await syncCartToServer();
    //location.reload(); // โหลดใหม่เพื่อให้ render session
  }
});*/
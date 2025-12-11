async function addToCartSession(bookId, qty = 1) {
  const payload = {
    id: Number(bookId), // 👈 บังคับให้เป็นเลข
    qty: Number(qty),
  };

  const res = await fetch("/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("Failed to add cart", await res.text());
    return;
  }

  const data = await res.json();
  console.log("Cart Updated:", data);

  updateCartCountFromSession(); // 👈 sync count จาก server
}

async function updateCartCountFromSession() {
  const res = await fetch("/cart/count");
  const data = await res.json();

  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.textContent = data.count || 0;
  }
}

async function checkout() {
    const btnPay = document.getElementById("btnPay");

    btnPay.disabled = true;
    btnPay.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';

    // เก็บข้อมูลจากฟอร์ม
    const form = document.getElementById("checkoutForm");
    const formData = new FormData(form);

    const payload = Object.fromEntries(formData.entries());

    try {
        const res = await fetch("/cart/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            window.location.href = "/cart/summary?orderId=" + data.orderId;
        } else {
            alert("เกิดข้อผิดพลาด: " + (data.message || "ไม่สามารถชำระเงินได้"));
        }
    } catch (err) {
        alert("Network error");
    }

    btnPay.disabled = false;
    btnPay.innerHTML = "Pay Now";
}

function processPayment() {
    const btnPay = document.getElementById("btnPay");

    btnPay.disabled = true;
    btnPay.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    btnPay.style.opacity = '0.8';

    setTimeout(() => {
        btnPay.innerHTML = '<i class="fa-solid fa-check"></i> Payment Successful!';
        btnPay.style.backgroundColor = '#27ae60';
        window.location.href = "/cart/summary";
    }, 2000);
}

// ✓ ปรับจำนวนบนหน้า detail
function adjustQty(amount) {
  const qtyEl = document.getElementById("qtyDisplay");
  let qty = parseInt(qtyEl.textContent) + amount;

  if (qty < 1) qty = 1;
  qtyEl.textContent = qty;
}

document.addEventListener("DOMContentLoaded", updateCartCountFromSession);
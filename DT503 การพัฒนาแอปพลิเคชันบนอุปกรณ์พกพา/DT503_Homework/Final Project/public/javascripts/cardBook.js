// ฟังก์ชันเปลี่ยนหมวดหมู่ (Filter)
function filterBooks(category, btn) {
  // จัดการปุ่ม Active
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");

  // จัดการแสดงผลการ์ด
  const cards = document.querySelectorAll(".book-card");
  cards.forEach((card) => {
    // Reset Animation
    card.classList.remove("fade-in");
    void card.offsetWidth; // Trigger reflow

    if (category === "all" || card.dataset.category === category) {
      card.style.display = "flex";
      card.classList.add("fade-in");
    } else {
      card.style.display = "none";
    }
  });
}

// ฟังก์ชันกดใส่ตะกร้า (Add to Cart Animation)
function addToCart(btn) {
  const originalContent = btn.innerHTML;

  // เปลี่ยนไอคอนเป็นเครื่องหมายถูก
  btn.innerHTML = '<i class="fa-solid fa-check"></i>';
  btn.style.backgroundColor = "#27ae60"; // สีเขียว
  btn.style.color = "white";
  btn.style.borderColor = "#27ae60";

  // คืนค่าเดิมหลังจาก 1.5 วินาที
  setTimeout(() => {
    btn.innerHTML = originalContent;
    btn.style.backgroundColor = "";
    btn.style.color = "";
    btn.style.borderColor = "";
  }, 1500);
}

// 1. 3D Tilt Effect Logic
const tiltArea = document.getElementById("tiltArea");
const bookCover = document.getElementById("bookCover");

tiltArea.addEventListener("mousemove", (e) => {
  const rect = tiltArea.getBoundingClientRect();
  const x = e.clientX - rect.left; // Mouse X inside element
  const y = e.clientY - rect.top; // Mouse Y inside element

  // คำนวณจุดกึ่งกลาง
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // คำนวณองศาการหมุน (Rotate Y = แกนตั้ง, Rotate X = แกนนอน)
  // หารด้วยตัวเลขเยอะๆ เพื่อลดความไวในการหมุน
  const rotateX = -((y - centerY) / 20);
  const rotateY = (x - centerX) / 20;

  bookCover.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
});

tiltArea.addEventListener("mouseleave", () => {
  // Reset กลับสู่สภาพเดิมเมื่อเมาส์ออก
  bookCover.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
});

// --- Form Logic ---
const form = document.getElementById("contact-form");
const successMessage = document.getElementById("success-message");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", (e) => {
  e.preventDefault();

  // Show loading state
  const originalBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "กำลังส่งข้อมูล...";

  // Simulate API call
  setTimeout(() => {
    // Hide form, show success
    form.classList.add("hidden");
    successMessage.classList.remove("hidden");
    successMessage.classList.add("flex");

    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
    form.reset();

    // Reset after 3 seconds
    setTimeout(() => {
      successMessage.classList.add("hidden");
      successMessage.classList.remove("flex");
      form.classList.remove("hidden");
    }, 3000);
  }, 1500);
});

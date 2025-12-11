// 3. Reveal Animation on Scroll (Intersection Observer)
      const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target); // Animate once
          }
        });
      }, observerOptions);

      document.querySelectorAll(".reveal").forEach((el) => {
        observer.observe(el);
      });
      window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
        window.location.reload();
    }
});

async function loadUserProfile() {
    try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;

        const data = await res.json();
        if (!data.loggedIn) return;

        // แสดงชื่อบน navbar
        const nameSlot = document.getElementById("navbar-username");
        if (nameSlot) {
            nameSlot.innerText = data.user.fullname;
        }

        // แสดงโปรไฟล์ในหน้า account
        const emailSlot = document.getElementById("profile-email");
        if (emailSlot) {
            emailSlot.innerText = data.user.email;
        }

    } catch (err) {
        console.error("User load failed", err);
    }
}

// เรียกตอนโหลดหน้า
document.addEventListener("DOMContentLoaded", loadUserProfile);

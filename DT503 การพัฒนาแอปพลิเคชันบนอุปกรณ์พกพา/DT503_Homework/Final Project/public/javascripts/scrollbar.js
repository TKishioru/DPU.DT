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

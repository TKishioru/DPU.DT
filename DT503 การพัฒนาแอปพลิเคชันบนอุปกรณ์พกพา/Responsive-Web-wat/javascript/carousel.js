// --- Carousel Logic ---
let currentIndex = 0;
const slides = document.querySelectorAll(".slide");
const dotsContainer = document.getElementById("carousel-dots");
const totalSlides = slides.length;
let intervalId;

// Animation classes for dots
const baseDotClass =
  "h-3 rounded-full transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] cursor-pointer shadow-md border border-white/10";
const activeDotClass =
  "w-12 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-100 opacity-100 ring-2 ring-white/30";
const inactiveDotClass =
  "w-3 bg-white/40 hover:bg-white hover:w-5 hover:scale-110 opacity-70";

// Create dots
for (let i = 0; i < totalSlides; i++) {
  const dot = document.createElement("div");
  dot.className = `${baseDotClass} ${
    i === 0 ? activeDotClass : inactiveDotClass
  }`;
  dot.addEventListener("click", () => goToSlide(i));
  dotsContainer.appendChild(dot);
}
const dots = dotsContainer.children;

function updateSlideClasses(index) {
  const content = slides[index].querySelector(".absolute.flex");
  if (content) {
    content.classList.remove("slide-inactive");
    content.classList.add("slide-active");
  }
}

function resetSlideClasses(index) {
  const content = slides[index].querySelector(".absolute.flex");
  if (content) {
    content.classList.remove("slide-active");
    content.classList.add("slide-inactive");
  }
}

function goToSlide(index) {
  if (index === currentIndex) return;

  // Reset current
  slides[currentIndex].classList.remove("opacity-100");
  slides[currentIndex].classList.add("opacity-0");
  resetSlideClasses(currentIndex);

  // Update dot style (inactive)
  dots[currentIndex].className = `${baseDotClass} ${inactiveDotClass}`;

  currentIndex = index;

  // Set new
  slides[currentIndex].classList.remove("opacity-0");
  slides[currentIndex].classList.add("opacity-100");
  updateSlideClasses(currentIndex);

  // Update dot style (active)
  dots[currentIndex].className = `${baseDotClass} ${activeDotClass}`;

  resetTimer();
}

function nextSlide() {
  const newIndex = currentIndex === totalSlides - 1 ? 0 : currentIndex + 1;
  goToSlide(newIndex);
}

function prevSlide() {
  const newIndex = currentIndex === 0 ? totalSlides - 1 : currentIndex - 1;
  goToSlide(newIndex);
}

function resetTimer() {
  clearInterval(intervalId);
  intervalId = setInterval(nextSlide, 6000);
}

document.getElementById("next-slide").addEventListener("click", nextSlide);
document.getElementById("prev-slide").addEventListener("click", prevSlide);

// Start auto-play
resetTimer();

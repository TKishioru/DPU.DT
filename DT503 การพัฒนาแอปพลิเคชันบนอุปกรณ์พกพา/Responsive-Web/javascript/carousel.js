// --- Carousel Logic ---
const images = [
  'image/background01.png',
  'image/background02.png',
  'image/background03.png'
];

const container = document.getElementById('slides-container');
const dotsContainer = document.getElementById('carousel-dots');
let currentSlide = 0;

// Dot Animation Classes
const baseDotClass =
  "h-3 rounded-full transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] cursor-pointer shadow-md border border-white/10";
const activeDotClass =
  "w-12 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-100 opacity-100 ring-2 ring-white/30";
const inactiveDotClass =
  "w-3 bg-white/40 hover:bg-white hover:w-5 hover:scale-110 opacity-70";

// -----------------------
// Generate Slides + Dots
// -----------------------
images.forEach((img, index) => {
  const slideDiv = document.createElement('div');
  slideDiv.className = `absolute top-0 left-0 w-full h-full bg-center bg-cover bg-magic-dark/80 transition-opacity duration-1000 ease-in-out ${index === 0 ? 'opacity-100' : 'opacity-0'}`;
  slideDiv.style.backgroundImage = `url('${img}')`;
  container.appendChild(slideDiv);

  // Dot
  const dot = document.createElement("div");
  dot.className =
    baseDotClass + " " + (index === 0 ? activeDotClass : inactiveDotClass);
  dot.onclick = () => goToSlide(index);
  dotsContainer.appendChild(dot);
});

const slides = container.children;
const dots = dotsContainer.children;

// -----------------------
// Update Slide + Dot
// -----------------------
function updateSlides() {
  for (let i = 0; i < slides.length; i++) {
    slides[i].classList.remove('opacity-100');
    slides[i].classList.add('opacity-0');

    // Inactive dots animation
    dots[i].className = `${baseDotClass} ${inactiveDotClass}`;
  }

  // Activate slide
  slides[currentSlide].classList.remove('opacity-0');
  slides[currentSlide].classList.add('opacity-100');

  // Active dot
  dots[currentSlide].className = `${baseDotClass} ${activeDotClass}`;
}

function nextSlide() {
  currentSlide = (currentSlide + 1) % images.length;
  updateSlides();
}

function prevSlide() {
  currentSlide = (currentSlide - 1 + images.length) % images.length;
  updateSlides();
}

function goToSlide(index) {
  currentSlide = index;
  updateSlides();
}

// Button events
document.getElementById('next-slide').addEventListener('click', nextSlide);
document.getElementById('prev-slide').addEventListener('click', prevSlide);

// Autoplay
setInterval(nextSlide, 5000);

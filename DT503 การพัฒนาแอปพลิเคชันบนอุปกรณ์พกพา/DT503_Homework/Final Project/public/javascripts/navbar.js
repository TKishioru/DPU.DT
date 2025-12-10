    // 1. Navbar Scroll Effect (Glassmorphism & Opacity)
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('py-2');
            navbar.classList.remove('py-4', 'bg-transparent');
        } else {
            navbar.classList.add('py-4', 'bg-transparent');
            navbar.classList.remove('py-2');
        }
    });

    // 2. Mobile Menu Logic
    const menuBtn = document.getElementById('mobile-menu-btn');
    const closeMenu = document.getElementById('close-menu');
    const mobileMenu = document.getElementById('mobile-menu');

    menuBtn.addEventListener('click', () => {
        mobileMenu.classList.remove('translate-x-full');
    });

    closeMenu.addEventListener('click', () => {
        mobileMenu.classList.add('translate-x-full');
    });

    // Close menu when clicking links
    document.querySelectorAll('#mobile-menu a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('translate-x-full');
        });
    });
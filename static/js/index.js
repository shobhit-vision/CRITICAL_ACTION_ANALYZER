document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const mobileAuth = document.querySelector('.mobile-auth');
    const areasDropdown = document.querySelector('.areas-dropdown');
    const body = document.body;
    
    // Toggle mobile menu
    function toggleMobileMenu() {
        const isMenuOpen = navLinks.classList.toggle('active');
        mobileAuth.classList.toggle('active');
        body.classList.toggle('menu-open', isMenuOpen);
        
        // Toggle menu icon
        const menuIcon = mobileMenuBtn.querySelector('i');
        if (isMenuOpen) {
            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-times');
        } else {
            menuIcon.classList.remove('fa-times');
            menuIcon.classList.add('fa-bars');
            // Close areas dropdown when closing menu
            areasDropdown.classList.remove('active');
        }
    }
    
    mobileMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMobileMenu();
    });

    // Toggle areas dropdown on mobile
    const areasLink = document.querySelector('.areas-dropdown .nav-link');
    areasLink.addEventListener('click', function(e) {
        if (window.innerWidth <= 992) {
            e.preventDefault();
            e.stopPropagation();
            areasDropdown.classList.toggle('active');
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        // Close areas dropdown when clicking outside
        if (window.innerWidth <= 992 && 
            !areasDropdown.contains(e.target) && 
            areasDropdown.classList.contains('active')) {
            areasDropdown.classList.remove('active');
        }
        
        // Close entire menu when clicking outside of navbar
        if (window.innerWidth <= 992 && 
            navLinks.classList.contains('active') &&
            !e.target.closest('.nav-container') &&
            !e.target.closest('.nav-links')) {
            toggleMobileMenu();
        }
    });

    // Close menu when clicking on links (for single page applications)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            // Don't prevent default for area dropdown toggle
            if (this === areasLink && window.innerWidth <= 992) {
                return;
            }
            
            if (window.innerWidth <= 992) {
                // Close menu after a short delay for better UX
                setTimeout(() => {
                    toggleMobileMenu();
                }, 300);
            }
        });
    });
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Close mobile menu when resizing to desktop view
            if (window.innerWidth > 992) {
                navLinks.classList.remove('active');
                mobileAuth.classList.remove('active');
                body.classList.remove('menu-open');
                areasDropdown.classList.remove('active');
                
                const menuIcon = mobileMenuBtn.querySelector('i');
                menuIcon.classList.remove('fa-times');
                menuIcon.classList.add('fa-bars');
            }
        }, 250);
    });
    
    // Handle Escape key to close menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && window.innerWidth <= 992) {
            if (areasDropdown.classList.contains('active')) {
                areasDropdown.classList.remove('active');
            } else if (navLinks.classList.contains('active')) {
                toggleMobileMenu();
            }
        }
    });
});
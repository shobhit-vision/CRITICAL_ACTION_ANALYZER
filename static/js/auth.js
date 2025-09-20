
// Function to close the window (works when window was opened by JavaScript)
function closeWindow() {
    window.close();
}

// Alternative method for browsers that block window.close()
function goHome() {
    window.location.href = '/';
}

// Add keyboard shortcut (ESC key to close)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Try to close window, if not possible go to homepage
        try {
            closeWindow();
        } catch (e) {
            goHome();
        }
    }
});

// Enhanced togglePassword function with better accessibility
function togglePassword(element) {
    const passwordInput = element.parentElement.querySelector('input');
    const eyeIcon = element.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
        element.setAttribute('aria-label', 'Hide password');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
        element.setAttribute('aria-label', 'Show password');
    }
    
    // Focus back on the input for better UX
    passwordInput.focus();
}

// Auto-hide alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
    const alerts = document.querySelectorAll('.alert');
    
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.5s';
            setTimeout(() => alert.remove(), 500);
        }, 5000);
    });
});
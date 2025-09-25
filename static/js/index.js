// index.js
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
    if (areasLink) {
        areasLink.addEventListener('click', function(e) {
            if (window.innerWidth <= 992) {
                e.preventDefault();
                e.stopPropagation();
                areasDropdown.classList.toggle('active');
            }
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        // Close areas dropdown when clicking outside
        if (window.innerWidth <= 992 && 
            areasDropdown && 
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
                if (areasDropdown) {
                    areasDropdown.classList.remove('active');
                }
                
                const menuIcon = mobileMenuBtn.querySelector('i');
                menuIcon.classList.remove('fa-times');
                menuIcon.classList.add('fa-bars');
            }
        }, 250);
    });
    
    // Handle Escape key to close menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && window.innerWidth <= 992) {
            if (areasDropdown && areasDropdown.classList.contains('active')) {
                areasDropdown.classList.remove('active');
            } else if (navLinks.classList.contains('active')) {
                toggleMobileMenu();
            }
        }
    });

    // Initialize time and report manager
    initializeTimeReportManager();
});


// Time and Report Manager Logic ---------------------------------------------
// Global variables for time and report management
let analysisDuration = 5; // Default 5 seconds
let analysisDataAvailable = false;
let analysisTimer = null;
let analysisStartTime = null;

// Initialize time selection and report functionality
function initializeTimeReportManager() {
    initializeTimeSelection();
    initializeReportButton();
    console.log('Time and Report Manager initialized');
}

// Initialize time selection slider
function initializeTimeSelection() {
    const timeSlider = document.getElementById('analysis-time-slider');
    const timeValue = document.getElementById('selected-time-value');
    const timeDisplay = document.getElementById('time-display');

    if (!timeSlider || !timeValue || !timeDisplay) {
        console.warn('Time selection elements not found');
        return;
    }

    // Set initial display
    updateTimeDisplay(analysisDuration, timeValue, timeDisplay);

    // Add event listener for slider changes
    timeSlider.addEventListener('input', function() {
        analysisDuration = parseInt(this.value);
        updateTimeDisplay(analysisDuration, timeValue, timeDisplay);
    });

    console.log('Time selection initialized with duration:', analysisDuration);
}

// Update time display with animation
function updateTimeDisplay(duration, timeValue, timeDisplay) {
    if (!timeValue || !timeDisplay) return;

    // Add animation class
    timeValue.classList.add('time-change-animation');
    timeDisplay.classList.add('time-change-animation');

    // Update values
    timeValue.textContent = `${duration} seconds`;
    timeDisplay.textContent = duration;

    // Remove animation class after animation completes
    setTimeout(() => {
        timeValue.classList.remove('time-change-animation');
        timeDisplay.classList.remove('time-change-animation');
    }, 300);
}

// Initialize report generation button
function initializeReportButton() {
    const reportButton = document.getElementById('generate-report-btn');
    const reportSection = document.getElementById('report-section');

    if (!reportButton || !reportSection) {
        console.warn('Report button elements not found');
        return;
    }

    // Initially hide the report section
    reportSection.style.display = 'none';

    // Add click event listener
    reportButton.addEventListener('click', generateReport);

    console.log('Report button initialized');
}

// Show report button when analysis data is available
function showReportButton() {
    const reportSection = document.getElementById('report-section');
    if (!reportSection) return;

    analysisDataAvailable = true;
    reportSection.style.display = 'block';

    // Add fade-in animation
    reportSection.style.opacity = '0';
    reportSection.style.transition = 'opacity 0.5s ease';

    setTimeout(() => {
        reportSection.style.opacity = '1';
    }, 10);

    console.log('Report button shown - analysis data available');
}

// Hide report button (when data is reset)
function hideReportButton() {
    const reportSection = document.getElementById('report-section');
    if (!reportSection) return;

    analysisDataAvailable = false;

    // Add fade-out animation
    reportSection.style.opacity = '0';
    reportSection.style.transition = 'opacity 0.3s ease';

    setTimeout(() => {
        reportSection.style.display = 'none';
        reportSection.style.opacity = '1';
    }, 300);

    console.log('Report button hidden');
}

// Start analysis timer with selected duration
function startAnalysisTimerWithDuration() {
    if (analysisTimer) {
        clearTimeout(analysisTimer);
    }

    analysisStartTime = Date.now();
    console.log(`Analysis timer started for ${analysisDuration} seconds`);

    // Set timeout to automatically stop analysis after selected duration
    analysisTimer = setTimeout(() => {
        if (window.isCameraActive && window.isCameraActive()) {
            console.log('Analysis duration completed - stopping camera');
            if (window.stopCameraAnalysis) {
                window.stopCameraAnalysis();
            }
        }
    }, analysisDuration * 1000);

    return analysisTimer;
}

// Stop analysis timer
function stopAnalysisTimer() {
    if (analysisTimer) {
        clearTimeout(analysisTimer);
        analysisTimer = null;
    }

    if (analysisStartTime) {
        const elapsedTime = (Date.now() - analysisStartTime) / 1000;
        console.log(`Analysis stopped after ${elapsedTime.toFixed(1)} seconds`);
        analysisStartTime = null;
    }
}

// Generate detailed report
function generateReport() {
    if (!analysisDataAvailable) {
        console.warn('No analysis data available for report generation');
        alert('No analysis data available. Please run an analysis first.');
        return;
    }

    console.log('Generating detailed report...');

    // Collect analysis data
    const reportData = collectReportData();

    // Store report data in sessionStorage for the report page
    try {
        sessionStorage.setItem('analysisReport', JSON.stringify(reportData));
        console.log('Report data stored successfully');

        // Navigate to report page
        window.location.href = 'report.html';
    } catch (error) {
        console.error('Error storing report data:', error);
        alert('Error generating report. Please try again.');
    }
}

// Collect data for the report
function collectReportData() {
    // Get current metrics
    const metrics = getCurrentMetrics();
    
    // Get analysis duration information
    const durationInfo = {
        selectedDuration: analysisDuration,
        actualDuration: analysisStartTime ? (Date.now() - analysisStartTime) / 1000 : 0,
        timestamp: new Date().toISOString()
    };

    // Get pose history if available
    const poseData = window.poseHistory ? window.poseHistory.slice() : [];

    return {
        metrics: metrics,
        duration: durationInfo,
        poseData: poseData,
        insights: generateInsights()
    };
}

// Get current metrics from the UI
function getCurrentMetrics() {
    const metrics = {};
    
    // Extract metric values from the UI
    const metricIds = ['posture-score', 'balance-score', 'symmetry-score', 'motion-score'];
    
    metricIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const value = parseInt(element.textContent) || 0;
            metrics[id.replace('-score', '')] = value;
        }
    });

    return metrics;
}

// Generate insights based on current data
function generateInsights() {
    // This would typically contain more sophisticated analysis
    return {
        summary: "Movement analysis completed successfully.",
        recommendations: [
            "Maintain consistent posture during exercises",
            "Focus on balance improvement",
            "Regular practice will enhance symmetry"
        ]
    };
}

// Get current analysis duration
function getAnalysisDuration() {
    return analysisDuration;
}

// Check if analysis data is available
function isAnalysisDataAvailable() {
    return analysisDataAvailable;
}

// Add CSS animation for time changes
function addTimeChangeAnimation() {
    if (!document.getElementById('timeChangeStyles')) {
        const style = document.createElement('style');
        style.id = 'timeChangeStyles';
        style.textContent = `
            .time-change-animation {
                animation: timePulse 0.3s ease-in-out;
            }
            
            @keyframes timePulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Make functions available globally for other modules
window.timeReportManager = {
    showReportButton,
    hideReportButton,
    startAnalysisTimerWithDuration,
    stopAnalysisTimer,
    getAnalysisDuration,
    isAnalysisDataAvailable
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    addTimeChangeAnimation();
});
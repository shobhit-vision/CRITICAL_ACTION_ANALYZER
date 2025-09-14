// Settings Page Functionality
document.addEventListener('DOMContentLoaded', function() {
  // Tab navigation
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.settings-panel');
  
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all items
      navItems.forEach(navItem => navItem.classList.remove('active'));
      panels.forEach(panel => panel.classList.remove('active'));
      
      // Add active class to clicked item
      this.classList.add('active');
      
      // Show corresponding panel
      const targetSection = this.getAttribute('data-section');
      const targetPanel = document.getElementById(targetSection);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
  
  // Theme selector
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    option.addEventListener('click', function() {
      themeOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      const theme = this.getAttribute('data-theme');
      // Here you would typically save the theme preference and apply it
      console.log('Theme changed to:', theme);
      
      // Apply theme to the body
      document.body.setAttribute('data-theme', theme);
    });
  });
  
  // Confidence slider
  const confidenceSlider = document.querySelector('.slider-confidence');
  const confidenceValue = document.querySelector('.slider-value');
  
  if (confidenceSlider && confidenceValue) {
    confidenceSlider.addEventListener('input', function() {
      confidenceValue.textContent = `${this.value}%`;
    });
  }
  
  // Toggle switches
  const toggleSwitches = document.querySelectorAll('.switch input');
  toggleSwitches.forEach(toggle => {
    toggle.addEventListener('change', function() {
      const setting = this.parentElement.parentElement.parentElement
        .querySelector('h3').textContent;
      console.log(`${setting} changed to: ${this.checked}`);
    });
  });
  
  // Form selects
  const formSelects = document.querySelectorAll('.form-select');
  formSelects.forEach(select => {
    select.addEventListener('change', function() {
      const setting = this.parentElement.parentElement
        .querySelector('h3').textContent;
      console.log(`${setting} changed to: ${this.value}`);
    });
  });
  
  // Dangerous actions confirmation
  const dangerousButtons = document.querySelectorAll('.btn-danger');
  dangerousButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const action = this.textContent.trim();
      
      if (confirm(`Are you sure you want to ${action}? This action cannot be undone.`)) {
        // Proceed with the action
        console.log(`User confirmed: ${action}`);
        alert(`${action} process initiated.`);
      }
    });
  });
  
  // Helper function to find button by text content
  function findButtonByText(text) {
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
      if (button.textContent.trim() === text) {
        return button;
      }
    }
    return null;
  }
  
  // Export data button
  const exportButton = findButtonByText('Export Data');
  if (exportButton) {
    exportButton.addEventListener('click', function(e) {
      e.preventDefault();
      alert('Preparing your data export. You will receive an email when it is ready.');
    });
  }
  
  // Reset settings button
  const resetButton = findButtonByText('Reset All Settings');
  if (resetButton) {
    resetButton.addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Are you sure you want to reset all settings to their default values?')) {
        alert('All settings have been reset to their default values.');
        // Here you would actually reset the settings
      }
    });
  }
  
  // Initialize first tab as active if none is selected
  if (document.querySelectorAll('.nav-item.active').length === 0 && navItems.length > 0) {
    navItems[0].classList.add('active');
    const targetSection = navItems[0].getAttribute('data-section');
    const targetPanel = document.getElementById(targetSection);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }
  }
});
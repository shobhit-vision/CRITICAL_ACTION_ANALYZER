import { initializeApp } from './ui.js';
import { initializeCharts } from './chart_manager.js';
import { startCamera, stopCamera, resetData } from './camera_manager.js';
import { analyzePose } from './pose_analysis.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Export functions for use in other modules if needed
export { initializeCharts, startCamera, stopCamera, resetData, analyzePose };
// camera_manager.js
// Enhanced with proper pose history management

import { generateInsights, updateCameraStatus, toggleCameraOverlay, poseHistory, MAX_HISTORY } from './ui.js';
import { initializePose, onResultsPose } from './pose_analysis.js';

class CameraManager {
    constructor() {
        this.camera = null;
        this.pose = null;
        this.autoStopInterval = null;
        this.manualFrameInterval = null;
        this.isRunning = false;
        this.analysisStartTime = null;
        this.insightsInterval = null;
        this.lastPoseSaveTime = 0;
        this.poseSaveInterval = 1000; // Save pose data every second
    }

    // Safe DOM element retrieval
    getElement(selector) {
        try {
            if (selector.startsWith('#')) {
                return document.getElementById(selector.slice(1));
            }
            return document.querySelector(selector);
        } catch (error) {
            console.warn(`Element not found: ${selector}`, error);
            return null;
        }
    }

    // Update button states consistently
    updateButtonStates(running) {
        const buttons = {
            start: this.getElement('#start-camera'),
            stop: this.getElement('#stop-camera'),
            capture: this.getElement('#capture-frame'),
            reset: this.getElement('#reset-data')
        };

        if (!buttons.start || !buttons.stop) {
            console.warn('Start/Stop buttons not found');
            return;
        }

        Object.entries(buttons).forEach(([key, button]) => {
            if (!button) return;
            
            const isStartButton = key === 'start';
            const shouldEnable = running ? !isStartButton : isStartButton;
            
            button.disabled = !shouldEnable;
            button.classList.toggle('disabled', !shouldEnable);
            button.style.opacity = shouldEnable ? '1' : '0.5';
        });

        console.log(`Buttons updated: ${running ? 'Start disabled, Stop enabled' : 'Start enabled, Stop disabled'}`);
    }

    // Get analysis duration from timeReportManager or default
    getAnalysisDuration() {
        if (window.timeReportManager?.getAnalysisDuration) {
            return window.timeReportManager.getAnalysisDuration();
        }
        console.warn('timeReportManager unavailable - using default 5s');
        return 5;
    }

    // Initialize pose history for new session
    initializePoseHistory() {
        // Clear existing history
        poseHistory.length = 0;
        this.lastPoseSaveTime = 0;
        console.log('Pose history initialized');
    }

    // Save pose data at regular intervals (once per second)
    savePoseData(analysis) {
        if (!analysis) return;
        
        const currentTime = Date.now();
        
        // Save pose data every second or if it's the first frame
        if (currentTime - this.lastPoseSaveTime >= this.poseSaveInterval || this.lastPoseSaveTime === 0) {
            try {
                // Create a timestamped pose entry
                const poseEntry = {
                    ...analysis,
                    timestamp: currentTime,
                    elapsedTime: (currentTime - this.analysisStartTime) / 1000,
                    frameId: poseHistory.length + 1
                };
                
                // Add to history
                poseHistory.push(poseEntry);
                
                // Maintain history size limit
                if (poseHistory.length > MAX_HISTORY) {
                    poseHistory.shift(); // Remove oldest entry
                }
                
                this.lastPoseSaveTime = currentTime;
                
                // Log every 5 seconds for monitoring
                if (poseHistory.length % 5 === 0) {
                    console.log(`Pose history: ${poseHistory.length} entries, latest at ${poseEntry.elapsedTime.toFixed(1)}s`);
                }
                
            } catch (error) {
                console.error('Error saving pose data:', error);
            }
        }
    }

    // Get current pose history statistics
    getPoseHistoryStats() {
        return {
            totalEntries: poseHistory.length,
            duration: poseHistory.length > 0 ? 
                (poseHistory[poseHistory.length - 1].elapsedTime - poseHistory[0].elapsedTime) : 0,
            latestTimestamp: poseHistory.length > 0 ? poseHistory[poseHistory.length - 1].timestamp : null
        };
    }

    // Start auto-stop timer
    startAutoStopTimer(duration) {
        this.stopAutoStopTimer();

        console.log(`Auto-stop timer started: ${duration}s`);
        this.autoStopInterval = setInterval(() => {
            if (!this.isRunning || !this.analysisStartTime) return;

            const elapsed = (Date.now() - this.analysisStartTime) / 1000;
            console.log(`Timer: ${elapsed.toFixed(1)}s / ${duration}s`);

            if (elapsed >= duration) {
                console.log(`Duration complete: ${elapsed.toFixed(1)}s - stopping analysis`);
                this.stopCameraAnalysis();
            }
        }, 1000);
    }

    // Stop auto-stop timer
    stopAutoStopTimer() {
        if (this.autoStopInterval) {
            clearInterval(this.autoStopInterval);
            this.autoStopInterval = null;
            console.log('Auto-stop timer cleared');
        }
    }

    // Initialize camera stream
    async initializeCameraStream() {
        const videoElement = this.getElement('.input_video');
        if (!videoElement) {
            throw new Error('Video element not found');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        videoElement.srcObject = stream;

        await new Promise((resolve, reject) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(resolve).catch(reject);
            };
            videoElement.onerror = reject;
        });

        return videoElement;
    }

    // Initialize MediaPipe Pose
    async initializePoseDetection() {
        if (this.pose) {
            console.log('Pose detection already initialized');
            return this.pose;
        }

        this.pose = await initializePose();
        if (!this.pose) {
            throw new Error('Failed to initialize MediaPipe Pose');
        }

        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.pose.onResults(onResultsPose);
        console.log('MediaPipe Pose initialized successfully');
        return this.pose;
    }

    // Start MediaPipe camera with frame processing
    async startMediaPipeCamera(videoElement) {
        if (typeof window.Camera !== 'undefined') {
            this.camera = new window.Camera(videoElement, {
                onFrame: async () => {
                    if (this.pose && this.isRunning && videoElement.readyState >= 2) {
                        await this.pose.send({ image: videoElement });
                    }
                },
                width: 640,
                height: 480
            });
            await this.camera.start();
            console.log('MediaPipe Camera started');
            return true;
        }
        return false;
    }

    // Fallback: Manual frame processing
    startManualFrameProcessing(videoElement) {
        this.stopManualFrameProcessing();

        console.warn('MediaPipe Camera unavailable - using manual processing');
        let isProcessing = false;

        this.manualFrameInterval = setInterval(async () => {
            if (!this.isRunning || isProcessing || videoElement.readyState < 2) return;

            isProcessing = true;
            try {
                await this.pose.send({ image: videoElement });
            } catch (error) {
                console.error('Frame processing error:', error);
            }
            isProcessing = false;
        }, 33);
    }

    // Stop manual frame processing
    stopManualFrameProcessing() {
        if (this.manualFrameInterval) {
            clearInterval(this.manualFrameInterval);
            this.manualFrameInterval = null;
        }
    }

    // Main start function
    async startCamera() {
        if (this.isRunning) {
            console.log('Camera already running');
            return;
        }

        try {
            console.log('Starting camera analysis...');
            this.isRunning = true;
            this.updateButtonStates(true);

            // Initialize pose history for new session
            this.initializePoseHistory();

            // Set analysis start time
            this.analysisStartTime = Date.now();
            if (window.timeReportManager?.setAnalysisStartTime) {
                window.timeReportManager.setAnalysisStartTime();
            }

            const duration = this.getAnalysisDuration();
            
            // Initialize components
            const videoElement = await this.initializeCameraStream();
            await this.initializePoseDetection();

            // Start camera processing
            const mediaPipeSuccess = await this.startMediaPipeCamera(videoElement);
            if (!mediaPipeSuccess) {
                this.startManualFrameProcessing(videoElement);
            }

            // Start auto-stop timer
            this.startAutoStopTimer(duration);

            // Start insights generation
            this.startInsightsGeneration();

            // Update UI
            updateCameraStatus?.('Camera Active');
            toggleCameraOverlay?.(false);

            console.log(`Camera started successfully. Auto-stop in ${duration}s`);

        } catch (error) {
            console.error('Camera start failed:', error);
            this.handleStartError(error);
        }
    }

    // Handle camera start errors
    handleStartError(error) {
        this.isRunning = false;
        this.updateButtonStates(false);
        this.cleanup();

        updateCameraStatus?.('Camera Error');
        toggleCameraOverlay?.(true);

        const overlay = this.getElement('#camera-overlay');
        if (overlay) {
            overlay.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Error: ${error.message}`;
            overlay.style.display = 'block';
        }

        alert(`Camera start failed: ${error.message}. Check permissions and try again.`);
    }

    // Start periodic insights generation
    startInsightsGeneration() {
        this.stopInsightsGeneration();
        
        this.insightsInterval = setInterval(() => {
            if (this.isRunning && generateInsights) {
                generateInsights();
                
                // Log pose history stats periodically
                const stats = this.getPoseHistoryStats();
                if (stats.totalEntries > 0) {
                    console.log(`Pose History: ${stats.totalEntries} entries over ${stats.duration.toFixed(1)}s`);
                }
            }
        }, 2000);
    }

    // Stop insights generation
    stopInsightsGeneration() {
        if (this.insightsInterval) {
            clearInterval(this.insightsInterval);
            this.insightsInterval = null;
        }
    }

    // Stop camera analysis
    stopCamera() {
        if (!this.isRunning) {
            console.log('Camera not running');
            return;
        }

        console.log('Stopping camera analysis...');
        this.isRunning = false;
        this.updateButtonStates(false);
        
        // Log final pose history stats
        const stats = this.getPoseHistoryStats();
        console.log(`Session completed: ${stats.totalEntries} pose entries over ${stats.duration.toFixed(1)}s`);
        
        this.cleanup();
        console.log('Camera stopped successfully');
    }

    // Cleanup resources
    cleanup() {
        this.stopAutoStopTimer();
        this.stopManualFrameProcessing();
        this.stopInsightsGeneration();

        if (window.timeReportManager?.stopAnalysisTimer) {
            window.timeReportManager.stopAnalysisTimer();
        }

        const videoElement = this.getElement('.input_video');
        if (videoElement?.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
            videoElement.pause();
        }

        if (this.camera?.stop) {
            this.camera.stop();
            this.camera = null;
        }

        if (this.pose?.close) {
            this.pose.close();
            this.pose = null;
        }

        updateCameraStatus?.('Camera Off');
        toggleCameraOverlay?.(true);
    }

    // Auto-stop analysis when duration completes
    stopCameraAnalysis() {
        console.log('Auto-stopping analysis (duration complete)');

        if (this.analysisStartTime) {
            const elapsed = (Date.now() - this.analysisStartTime) / 1000;
            console.log(`Analysis completed: ${elapsed.toFixed(1)}s elapsed`);
        }

        this.prepareAnalysisReport();
        this.showCompletionToast();
        this.stopCamera();
    }

    // Prepare analysis report data
    prepareAnalysisReport() {
        if (!window.timeReportManager) return;

        window.timeReportManager.isAnalysisDataAvailable = true;

        // Pass pose history to report manager
        if (window.timeReportManager.setPoseHistory) {
            window.timeReportManager.setPoseHistory([...poseHistory]);
        }

        if (window.timeReportManager.collectReportData) {
            try {
                const data = window.timeReportManager.collectReportData();
                console.log('Analysis data collected:', data);
            } catch (error) {
                console.warn('Error collecting report data:', error);
            }
        }

        if (window.timeReportManager.showReportButton) {
            window.timeReportManager.showReportButton();
        }
    }

    // Show completion toast
    showCompletionToast() {
        let toast = this.getElement('#analysis-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'analysis-toast';
            toast.style.cssText = `
                position: fixed; top: 20px; right: 20px; 
                background: #4CAF50; color: white; padding: 15px; 
                border-radius: 5px; z-index: 1000; display: none;
            `;
            document.body.appendChild(toast);
        }

        const duration = this.getAnalysisDuration();
        const stats = this.getPoseHistoryStats();
        toast.textContent = `Analysis complete (${duration}s). ${stats.totalEntries} pose samples collected.`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }

    // Reset all data including pose history
    resetData() {
        console.log('Resetting camera data...');
        
        if (this.isRunning) {
            this.stopCamera();
        }

        this.cleanup();
        this.initializePoseHistory(); // Clear pose history

        // Reset UI elements
        const elements = {
            '#landmarks-count': '0',
            '#confidence-score': '0%',
            '#frame-rate': '0 FPS'
        };

        Object.entries(elements).forEach(([selector, value]) => {
            const element = this.getElement(selector);
            if (element) element.textContent = value;
        });

        // Hide report
        if (window.timeReportManager?.hideReportButton) {
            window.timeReportManager.hideReportButton();
        }

        console.log('Camera data reset complete');
    }

    // Check if camera is active
    isCameraActive() {
        return this.isRunning;
    }

    // Get current pose history (for external access)
    getPoseHistory() {
        return [...poseHistory]; // Return copy to prevent mutation
    }
}

// Create singleton instance
const cameraManager = new CameraManager();

// Event listeners
document.addEventListener('visibilitychange', () => {
    if (document.hidden && cameraManager.isRunning) {
        console.log('Page hidden - pausing camera');
        cameraManager.stopCamera();
    }
});

window.addEventListener('beforeunload', () => {
    if (cameraManager.isRunning) {
        cameraManager.stopCamera();
    }
});

// Export functions
export async function startCamera() {
    return cameraManager.startCamera();
}

export function stopCamera() {
    return cameraManager.stopCamera();
}

export function stopCameraAnalysis() {
    return cameraManager.stopCameraAnalysis();
}

export function resetData() {
    return cameraManager.resetData();
}

export function isCameraActive() {
    return cameraManager.isCameraActive();
}

export function updateButtonStates(running) {
    return cameraManager.updateButtonStates(running);
}

export function getPoseHistory() {
    return cameraManager.getPoseHistory();
}

// Global exposure
window.cameraManager = cameraManager;
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.stopCameraAnalysis = stopCameraAnalysis;
window.isCameraActive = isCameraActive;
window.getPoseHistory = getPoseHistory;
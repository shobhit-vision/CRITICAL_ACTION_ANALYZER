// pose_analysis.js
// Enhanced with proper pose history saving

import { poseHistory, updateMetrics, updateLandmarkTable, updateSkeletonStatus, toggleSkeletonOverlay } from './ui.js';
import { updateCharts } from './chart_manager.js';
import { processPoseFrame, getCompleteAnalysisData, isAnalysisDurationComplete } from './pose_feature.js';

class PoseAnalyzer {
    constructor() {
        this.skeletonCanvas = null;
        this.skeletonCtx = null;
        this.skeletonOverlay = null;
        this.hasSkeletonCanvas = false;
        this.lastFrameTime = 0;
        this.frameRate = 0;
        this.frameCount = 0;
    }

    // Initialize skeleton canvas
    initializeSkeletonCanvas() {
        try {
            this.skeletonCanvas = document.getElementById('skeleton-canvas');
            
            if (!this.skeletonCanvas) {
                console.log('Skeleton canvas not found on this page');
                this.hasSkeletonCanvas = false;
                return true;
            }
            
            this.skeletonCtx = this.skeletonCanvas.getContext('2d');
            this.setSkeletonCanvasSize();
            this.skeletonOverlay = document.getElementById('skeleton-overlay');
            this.hasSkeletonCanvas = true;
            
            console.log('Skeleton canvas initialized');
            return true;
        } catch (error) {
            console.error('Skeleton canvas initialization failed:', error);
            this.hasSkeletonCanvas = false;
            return false;
        }
    }

    // Set canvas dimensions
    setSkeletonCanvasSize() {
        if (!this.skeletonCanvas) return;
        
        const container = this.skeletonCanvas.parentElement;
        if (container) {
            this.skeletonCanvas.width = container.clientWidth || 400;
            this.skeletonCanvas.height = container.clientHeight || 500;
        } else {
            this.skeletonCanvas.width = 400;
            this.skeletonCanvas.height = 500;
        }
    }

    // Calculate scaling factors for skeleton drawing
    calculateScalingFactors(landmarks) {
        if (!landmarks?.length) return null;
        
        const xs = landmarks.map(l => l.x);
        const ys = landmarks.map(l => l.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const width = maxX - minX || 1;
        const height = maxY - minY || 1;
        
        const scale = Math.min(
            this.skeletonCanvas.width * 0.8 / width,
            this.skeletonCanvas.height * 0.8 / height
        );
        
        const offsetX = (this.skeletonCanvas.width - width * scale) / 2 - minX * scale;
        const offsetY = (this.skeletonCanvas.height - height * scale) / 2 - minY * scale;
        
        return { scale, offsetX, offsetY };
    }

    // Draw skeleton connections
    drawSkeletonConnections(landmarks, scaling) {
        if (!window.POSE_CONNECTIONS || !this.skeletonCtx) return;
        
        this.skeletonCtx.strokeStyle = '#4a6bff';
        this.skeletonCtx.lineWidth = 3;
        this.skeletonCtx.lineCap = 'round';
        
        window.POSE_CONNECTIONS.forEach(([start, end]) => {
            if (landmarks[start] && landmarks[end]) {
                this.skeletonCtx.beginPath();
                this.skeletonCtx.moveTo(
                    landmarks[start].x * scaling.scale + scaling.offsetX,
                    landmarks[start].y * scaling.scale + scaling.offsetY
                );
                this.skeletonCtx.lineTo(
                    landmarks[end].x * scaling.scale + scaling.offsetX,
                    landmarks[end].y * scaling.scale + scaling.offsetY
                );
                this.skeletonCtx.stroke();
            }
        });
    }

    // Draw skeleton landmarks
    drawSkeletonLandmarks(landmarks, scaling) {
        if (!this.skeletonCtx) return;
        
        this.skeletonCtx.fillStyle = '#FF0000';
        
        landmarks.forEach(landmark => {
            this.skeletonCtx.beginPath();
            this.skeletonCtx.arc(
                landmark.x * scaling.scale + scaling.offsetX,
                landmark.y * scaling.scale + scaling.offsetY,
                4, 0, 2 * Math.PI
            );
            this.skeletonCtx.fill();
        });
    }

    // Update skeleton information display
    updateSkeletonInfo(landmarks) {
        if (!landmarks) return;
        
        // Update landmarks count
        const landmarksCountEl = document.getElementById('landmarks-count');
        if (landmarksCountEl) {
            const visibleLandmarks = landmarks.filter(l => l.visibility > 0.5).length;
            landmarksCountEl.textContent = `${visibleLandmarks}/${landmarks.length}`;
        }
        
        // Update confidence score
        const confidenceScoreEl = document.getElementById('confidence-score');
        if (confidenceScoreEl) {
            const avgConfidence = landmarks.reduce((sum, l) => sum + (l.visibility || 0), 0) / landmarks.length;
            confidenceScoreEl.textContent = `${Math.round(avgConfidence * 100)}%`;
        }
        
        // Update frame rate
        this.updateFrameRate();
    }

    // Calculate frame rate
    updateFrameRate() {
        this.frameCount++;
        const now = performance.now();
        
        if (this.lastFrameTime > 0) {
            const delta = now - this.lastFrameTime;
            
            // Update FPS display every 30 frames
            if (this.frameCount % 30 === 0) {
                this.frameRate = Math.round(1000 / delta);
                const frameRateEl = document.getElementById('frame-rate');
                if (frameRateEl) {
                    frameRateEl.textContent = `${this.frameRate} FPS`;
                }
            }
        }
        this.lastFrameTime = now;
    }

    // Main skeleton drawing function
    drawSkeleton(landmarks) {
        if (!this.hasSkeletonCanvas || !landmarks) {
            toggleSkeletonOverlay?.(true);
            updateSkeletonStatus?.('Not Tracking');
            return;
        }
        
        try {
            this.skeletonCtx.clearRect(0, 0, this.skeletonCanvas.width, this.skeletonCanvas.height);
            
            const scaling = this.calculateScalingFactors(landmarks);
            if (!scaling) {
                console.warn('Invalid scaling factors');
                return;
            }
            
            this.drawSkeletonConnections(landmarks, scaling);
            this.drawSkeletonLandmarks(landmarks, scaling);
            this.updateSkeletonInfo(landmarks);
            
            updateSkeletonStatus?.('Tracking');
            toggleSkeletonOverlay?.(false);
            
        } catch (error) {
            console.error('Skeleton drawing error:', error);
            toggleSkeletonOverlay?.(true);
            updateSkeletonStatus?.('Error');
        }
    }

    // Mathematical calculations
    calculateAngle(a, b, c) {
        try {
            const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
            let angle = Math.abs(radians * 180.0 / Math.PI);
            return angle > 180.0 ? 360 - angle : angle;
        } catch (error) {
            console.error('Angle calculation error:', error);
            return 0;
        }
    }

    calculateDistance(a, b) {
        try {
            return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
        } catch (error) {
            console.error('Distance calculation error:', error);
            return 0;
        }
    }

    // Analysis calculations
    calculateSymmetry(leftAngle, rightAngle) {
        const difference = Math.abs(leftAngle - rightAngle);
        return Math.max(0, 100 - (difference / 180 * 100));
    }

    calculateTorsoStability(landmarks) {
        try {
            const shoulderWidth = this.calculateDistance(landmarks[11], landmarks[12]);
            const hipWidth = this.calculateDistance(landmarks[23], landmarks[24]);
            
            if (shoulderWidth === 0) return 100;
            
            const stability = 100 - Math.abs(shoulderWidth - hipWidth) / shoulderWidth * 100;
            return Math.max(0, Math.min(100, stability));
        } catch (error) {
            console.error('Torso stability calculation error:', error);
            return 100;
        }
    }

    calculateBalance(landmarks) {
        try {
            const leftAnkle = landmarks[27];
            const rightAnkle = landmarks[28];
            const midHip = {
                x: (landmarks[23].x + landmarks[24].x) / 2,
                y: (landmarks[23].y + landmarks[24].y) / 2
            };
            
            const shoulderWidth = this.calculateDistance(landmarks[11], landmarks[12]);
            if (shoulderWidth === 0) return 100;
            
            const balance = 100 - Math.abs(
                (midHip.x - (leftAnkle.x + rightAnkle.x) / 2) / shoulderWidth * 100
            );
            
            return Math.max(0, Math.min(100, balance));
        } catch (error) {
            console.error('Balance calculation error:', error);
            return 100;
        }
    }

    calculateMotionQuality() {
        try {
            if (poseHistory.length < 5) return 85;
            
            const recentAngles = poseHistory.slice(-5).map(a => a.angles?.leftElbow || 0);
            const differences = recentAngles.slice(1).map((val, i) => Math.abs(val - recentAngles[i]));
            const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
            
            return Math.max(0, 100 - avgDifference * 2);
        } catch (error) {
            console.error('Motion quality calculation error:', error);
            return 85;
        }
    }

    // Main pose analysis function
    analyzePose(landmarks) {
        if (!landmarks || landmarks.length < 33) {
            console.warn('Invalid landmarks data');
            return null;
        }
        
        try {
            // Use pose_feature.js for comprehensive analysis
            const poseFeatures = processPoseFrame(landmarks);
            if (!poseFeatures) return null;
            
            // Calculate basic angles for UI
            const angles = {
                leftElbow: this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
                rightElbow: this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
                leftKnee: this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
                rightKnee: this.calculateAngle(landmarks[24], landmarks[26], landmarks[28])
            };
            
            const analysis = {
                angles: angles,
                symmetry: this.calculateSymmetry(angles.leftElbow, angles.rightElbow),
                torsoStability: this.calculateTorsoStability(landmarks),
                balance: this.calculateBalance(landmarks),
                motionQuality: this.calculateMotionQuality(),
                landmarks: landmarks,
                timestamp: Date.now(),
                frameCount: this.frameCount,
                poseFeatures: poseFeatures
            };
            
            return analysis;
            
        } catch (error) {
            console.error('Pose analysis error:', error);
            return null;
        }
    }

    // Process MediaPipe results
    onResultsPose(results) {
        const canvasElement = document.querySelector('.output_canvas');
        if (!canvasElement) {
            console.warn('Output canvas not found');
            return;
        }
        
        try {
            const canvasCtx = canvasElement.getContext('2d');
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // Draw camera feed
            if (results.image) {
                canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            }
            
            // Process pose landmarks
            if (results.poseLandmarks) {
                this.drawSkeleton(results.poseLandmarks);
                
                const analysis = this.analyzePose(results.poseLandmarks);
                if (analysis) {
                    // Update UI components
                    updateMetrics?.(analysis);
                    updateLandmarkTable?.(results.poseLandmarks);
                    updateCharts?.(analysis);
                    
                    // Pose history is now managed by camera_manager.js
                    // This prevents duplicate entries and ensures proper timing
                    
                    // Check for auto-stop condition
                    this.checkAutoStopCondition();
                }
            } else {
                toggleSkeletonOverlay?.(true);
                updateSkeletonStatus?.('Not Tracking');
            }
            
            canvasCtx.restore();
            
        } catch (error) {
            console.error('Pose results processing error:', error);
        }
    }

    // Check if analysis duration is complete
    checkAutoStopCondition() {
        const duration = window.timeReportManager?.getAnalysisDuration?.() || 30;
        
        if (isAnalysisDurationComplete(duration)) {
            console.log('Analysis duration complete, stopping camera...');
            window.stopCameraAnalysis?.();
        }
    }

    // Initialize MediaPipe Pose
    initializePose() {
        this.initializeSkeletonCanvas();
        
        if (typeof window.Pose === 'undefined') {
            this.showMediaPipeError();
            return null;
        }
        
        try {
            const pose = new window.Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.2/${file}`;
                }
            });
            
            pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            pose.onResults(this.onResultsPose.bind(this));
            return pose;
            
        } catch (error) {
            console.error('MediaPipe Pose initialization failed:', error);
            return null;
        }
    }

    // Show MediaPipe loading error
    showMediaPipeError() {
        console.error('MediaPipe Pose not loaded correctly');
        
        const errorOverlay = document.getElementById('mediapipe-error');
        if (errorOverlay) {
            errorOverlay.style.display = 'block';
        }
        
        // Disable camera buttons
        ['start-camera', 'stop-camera'].forEach(btnId => {
            const button = document.getElementById(btnId);
            if (button) button.disabled = true;
        });
    }
}

// Create singleton instance
const poseAnalyzer = new PoseAnalyzer();

// Export functions
export function initializePose() {
    return poseAnalyzer.initializePose();
}

export function onResultsPose(results) {
    return poseAnalyzer.onResultsPose(results);
}

export function drawSkeleton(landmarks) {
    return poseAnalyzer.drawSkeleton(landmarks);
}

export function calculateAngle(a, b, c) {
    return poseAnalyzer.calculateAngle(a, b, c);
}

export function calculateDistance(a, b) {
    return poseAnalyzer.calculateDistance(a, b);
}

export function analyzePose(landmarks) {
    return poseAnalyzer.analyzePose(landmarks);
}

export function hasSkeletonCanvasElement() {
    return poseAnalyzer.hasSkeletonCanvas;
}

export function getCompletePoseAnalysisData() {
    return getCompleteAnalysisData();
}

export function isPoseAnalysisDurationComplete(selectedDuration) {
    return isAnalysisDurationComplete(selectedDuration);
}

// Global exposure
window.poseAnalyzer = poseAnalyzer;
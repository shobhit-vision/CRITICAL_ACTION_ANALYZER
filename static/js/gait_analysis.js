// Gait Analysis JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Initialize variables
  let cameraActive = false;
  let analysisTimer = null;
  let timerValue = 0;
  let poseResults = null;
  
  // DOM Elements
  const startCameraBtn = document.getElementById('start-camera');
  const stopCameraBtn = document.getElementById('stop-camera');
  const captureGaitBtn = document.getElementById('capture-gait');
  const cameraStatus = document.getElementById('camera-status');
  const cameraOverlay = document.getElementById('camera-overlay');
  const analysisTimerEl = document.getElementById('analysis-timer');
  const videoElement = document.querySelector('.input_video');
  const canvasElement = document.querySelector('.output_canvas');
  const canvasCtx = canvasElement.getContext('2d');
  
  // MediaPipe Pose setup
  const pose = new Pose({
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
  
  pose.onResults(onPoseResults);
  
  // Event Listeners
  startCameraBtn.addEventListener('click', startCamera);
  stopCameraBtn.addEventListener('click', stopCamera);
  captureGaitBtn.addEventListener('click', captureGaitFrame);
  
  // Initialize visualization tabs
  initVisualizationTabs();
  
  // Initialize charts
  initCharts();
  
  // Functions
  function startCamera() {
    cameraActive = true;
    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;
    cameraStatus.textContent = 'Camera Active';
    cameraStatus.previousElementSibling.classList.add('active');
    cameraOverlay.style.display = 'none';
    
    // Start camera
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (cameraActive) {
          await pose.send({image: videoElement});
        }
      },
      width: 640,
      height: 480
    });
    camera.start();
    
    // Start analysis timer
    startTimer();
    
    // Simulate gait analysis data (in a real app, this would come from MediaPipe)
    simulateGaitAnalysis();
  }
  
  function stopCamera() {
    cameraActive = false;
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    cameraStatus.textContent = 'Camera Off';
    cameraStatus.previousElementSibling.classList.remove('active');
    cameraOverlay.style.display = 'flex';
    
    // Stop timer
    stopTimer();
  }
  
  function captureGaitFrame() {
    if (!cameraActive) {
      alert('Please start the camera first to capture a frame.');
      return;
    }
    
    // Create a temporary canvas to capture the current frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvasElement, 0, 0);
    
    // Convert to data URL and download
    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `gait-analysis-${new Date().toISOString().replace(/:/g, '-')}.png`;
    link.href = dataURL;
    link.click();
    
    // Show confirmation message
    showNotification('Gait frame captured successfully!', 'success');
  }
  
  function onPoseResults(results) {
    poseResults = results;
    
    // Draw the overlay
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // Draw pose landmarks
    if (results.poseLandmarks) {
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 2,
        radius: 3,
        fillColor: '#4361ee'
      });
      
      // Draw connections
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 2
      });
      
      // Update gait analysis with new landmarks
      updateGaitAnalysis(results.poseLandmarks);
    }
    
    canvasCtx.restore();
  }
  
  function updateGaitAnalysis(landmarks) {
    if (!landmarks || landmarks.length === 0) return;
    
    // Calculate gait parameters based on landmarks
    // This is a simplified example - real implementation would be more complex
    
    // Calculate stride length (simplified)
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const hipDistance = Math.sqrt(
      Math.pow(leftHip.x - rightHip.x, 2) + 
      Math.pow(leftHip.y - rightHip.y, 2)
    );
    
    // Estimate stride length based on hip distance and height
    const height = parseInt(document.getElementById('height').value) || 170;
    const strideLength = (hipDistance * height * 2.5).toFixed(1);
    
    // Update UI with calculated values
    document.getElementById('stride-length').textContent = `Estimated: ${strideLength} cm`;
    document.getElementById('step-length-value').textContent = `${(strideLength / 2).toFixed(1)} cm`;
    
    // Calculate cadence based on time and steps (simulated)
    const cadence = Math.floor(60 + (timerValue / 2));
    document.getElementById('cadence').textContent = `Estimated: ${cadence} steps/min`;
    
    // Calculate symmetry (simplified)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const symmetryScore = Math.max(0, 100 - (shoulderDiff * 1000));
    
    document.getElementById('symmetry').textContent = `Score: ${symmetryScore.toFixed(1)}%`;
    document.getElementById('symmetry-score').textContent = `${symmetryScore.toFixed(1)}%`;
    document.getElementById('symmetry-progress').style.width = `${symmetryScore}%`;
    
    // Update other metrics
    document.getElementById('walking-speed-value').textContent = `${(strideLength * cadence / 5000).toFixed(2)} m/s`;
    document.getElementById('step-width-value').textContent = `${(hipDistance * height / 10).toFixed(1)} cm`;
    document.getElementById('stride-time-value').textContent = `${(60 / cadence).toFixed(2)} s`;
    
    // Update charts with new data
    updateCharts(strideLength, cadence, symmetryScore);
  }
  
  function startTimer() {
    timerValue = 0;
    analysisTimer = setInterval(() => {
      timerValue++;
      const minutes = Math.floor(timerValue / 60);
      const seconds = timerValue % 60;
      analysisTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }
  
  function stopTimer() {
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
  }
  
  function simulateGaitAnalysis() {
    // Simulate periodic updates to gait metrics
    setInterval(() => {
      if (!cameraActive) return;
      
      // Simulate small variations in metrics
      const strideElement = document.getElementById('step-length-value');
      let strideValue = parseFloat(strideElement.textContent);
      strideValue += (Math.random() - 0.5) * 2;
      strideElement.textContent = `${strideValue.toFixed(1)} cm`;
      
      const speedElement = document.getElementById('walking-speed-value');
      let speedValue = parseFloat(speedElement.textContent);
      speedValue += (Math.random() - 0.5) * 0.1;
      speedElement.textContent = `${speedValue.toFixed(2)} m/s`;
      
    }, 3000);
  }
  
  function initVisualizationTabs() {
    const tabs = document.querySelectorAll('.viz-tab');
    const panes = document.querySelectorAll('.viz-pane');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        
        // Deactivate all tabs and panes
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        
        // Activate current tab and pane
        tab.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
      });
    });
  }
  
  function initCharts() {
    // Initialize all charts with empty data
    initStepLengthChart();
    initStrideTimeChart();
    initWalkingSpeedChart();
    initStepWidthChart();
    initGaitPhaseChart();
    initJointAngleChart();
    initGaitComparisonChart();
    initProgressTrendChart();
  }
  
  function initStepLengthChart() {
    const ctx = document.getElementById('step-length-chart').getContext('2d');
    window.stepLengthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(10).fill(''),
        datasets: [{
          label: 'Step Length',
          data: Array(10).fill(0),
          borderColor: '#4361ee',
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            display: false
          },
          x: {
            display: false
          }
        }
      }
    });
  }
  
  // Initialize other charts similarly...
  function initStrideTimeChart() {
    const ctx = document.getElementById('stride-time-chart').getContext('2d');
    window.strideTimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(10).fill(''),
        datasets: [{
          label: 'Stride Time',
          data: Array(10).fill(0),
          borderColor: '#7209b7',
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            display: false
          },
          x: {
            display: false
          }
        }
      }
    });
  }
  
  function initWalkingSpeedChart() {
    const ctx = document.getElementById('walking-speed-chart').getContext('2d');
    window.walkingSpeedChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(10).fill(''),
        datasets: [{
          label: 'Walking Speed',
          data: Array(10).fill(0),
          borderColor: '#4cc9f0',
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            display: false
          },
          x: {
            display: false
          }
        }
      }
    });
  }
  
  function initStepWidthChart() {
    const ctx = document.getElementById('step-width-chart').getContext('2d');
    window.stepWidthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(10).fill(''),
        datasets: [{
          label: 'Step Width',
          data: Array(10).fill(0),
          borderColor: '#f72585',
          tension: 0.4,
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            display: false
          },
          x: {
            display: false
          }
        }
      }
    });
  }
  
  function initGaitPhaseChart() {
    const ctx = document.getElementById('gait-phase-chart').getContext('2d');
    window.gaitPhaseChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Heel Strike', 'Loading', 'Mid Stance', 'Terminal Stance', 'Pre-Swing', 'Swing'],
        datasets: [{
          label: 'Percentage of Gait Cycle',
          data: [12, 12, 18, 20, 10, 28],
          backgroundColor: [
            '#4361ee',
            '#4cc9f0',
            '#7209b7',
            '#3a0ca3',
            '#f72585',
            '#ff9e00'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }
  
  function initJointAngleChart() {
    const ctx = document.getElementById('joint-angle-chart').getContext('2d');
    window.jointAngleChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(20).fill('').map((_, i) => (i * 5).toString()),
        datasets: [
          {
            label: 'Left Knee',
            data: Array(20).fill(0).map(() => Math.random() * 60 + 10),
            borderColor: '#4361ee',
            tension: 0.4,
            fill: false
          },
          {
            label: 'Right Knee',
            data: Array(20).fill(0).map(() => Math.random() * 60 + 10),
            borderColor: '#f72585',
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {
              display: true,
              text: 'Angle (degrees)'
            }
          },
          x: {
            title: {
              display: true,
              text: '% of Gait Cycle'
            }
          }
        }
      }
    });
  }
  
  function initGaitComparisonChart() {
    const ctx = document.getElementById('gait-comparison-chart').getContext('2d');
    window.gaitComparisonChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
        datasets: [
          {
            label: 'Stride Length (cm)',
            data: [135, 137, 136, 139, 140, 142, 143],
            borderColor: '#4361ee',
            tension: 0.4,
            fill: false
          },
          {
            label: 'Cadence (steps/min)',
            data: [112, 110, 113, 115, 114, 116, 118],
            borderColor: '#f72585',
            tension: 0.4,
            fill: false,
            hidden: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
    
    // Add event listener to metric selector
    document.getElementById('compare-metric').addEventListener('change', function() {
      const metric = this.value;
      const chart = window.gaitComparisonChart;
      
      // Hide all datasets
      chart.data.datasets.forEach(dataset => {
        dataset.hidden = true;
      });
      
      // Show selected metric
      if (metric === 'stride-length') {
        chart.data.datasets[0].hidden = false;
        chart.options.scales.y.title.text = 'Stride Length (cm)';
      } else if (metric === 'cadence') {
        chart.data.datasets[1].hidden = false;
        chart.options.scales.y.title.text = 'Cadence (steps/min)';
      } else if (metric === 'speed') {
        // Would add speed dataset in real implementation
        chart.options.scales.y.title.text = 'Speed (m/s)';
      } else if (metric === 'symmetry') {
        // Would add symmetry dataset in real implementation
        chart.options.scales.y.title.text = 'Symmetry Index (%)';
      }
      
      chart.update();
    });
  }
  
  function initProgressTrendChart() {
    const ctx = document.getElementById('progress-trend-chart').getContext('2d');
    window.progressTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Gait Score',
          data: [65, 68, 70, 72, 71, 73, 75, 76, 75, 77, 78, 80],
          borderColor: '#4361ee',
          backgroundColor: 'rgba(67, 97, 238, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 50,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }
  
  function updateCharts(strideLength, cadence, symmetry) {
    // Update step length chart
    if (window.stepLengthChart) {
      window.stepLengthChart.data.datasets[0].data.push(parseFloat(strideLength));
      if (window.stepLengthChart.data.datasets[0].data.length > 10) {
        window.stepLengthChart.data.datasets[0].data.shift();
      }
      window.stepLengthChart.update();
    }
    
    // Update other charts similarly...
    if (window.strideTimeChart) {
      const strideTime = 60 / cadence;
      window.strideTimeChart.data.datasets[0].data.push(strideTime);
      if (window.strideTimeChart.data.datasets[0].data.length > 10) {
        window.strideTimeChart.data.datasets[0].data.shift();
      }
      window.strideTimeChart.update();
    }
    
    if (window.walkingSpeedChart) {
      const speed = (strideLength * cadence) / 5000;
      window.walkingSpeedChart.data.datasets[0].data.push(speed);
      if (window.walkingSpeedChart.data.datasets[0].data.length > 10) {
        window.walkingSpeedChart.data.datasets[0].data.shift();
      }
      window.walkingSpeedChart.update();
    }
    
    if (window.stepWidthChart) {
      // Simulate step width data
      const stepWidth = 8 + (Math.random() * 4);
      window.stepWidthChart.data.datasets[0].data.push(stepWidth);
      if (window.stepWidthChart.data.datasets[0].data.length > 10) {
        window.stepWidthChart.data.datasets[0].data.shift();
      }
      window.stepWidthChart.update();
    }
  }
  
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 1rem;
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Add close event
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }
    }, 5000);
  }
  
  // MediaPipe drawing functions (simplified versions)
  function drawLandmarks(ctx, landmarks, options) {
    const { color = '#FF0000', lineWidth = 2, radius = 3, fillColor } = options || {};
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    for (const landmark of landmarks) {
      ctx.beginPath();
      ctx.arc(
        landmark.x * canvasElement.width,
        landmark.y * canvasElement.height,
        radius,
        0,
        2 * Math.PI
      );
      
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  function drawConnectors(ctx, landmarks, connections, options) {
    const { color = '#00FF00', lineWidth = 2 } = options || {};
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    for (const connection of connections) {
      const [start, end] = connection;
      const startLandmark = landmarks[start];
      const endLandmark = landmarks[end];
      
      if (!startLandmark || !endLandmark) continue;
      
      ctx.beginPath();
      ctx.moveTo(
        startLandmark.x * canvasElement.width,
        startLandmark.y * canvasElement.height
      );
      ctx.lineTo(
        endLandmark.x * canvasElement.width,
        endLandmark.y * canvasElement.height
      );
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Simplified POSE_CONNECTIONS (in a real app, use the full MediaPipe definition)
  const POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Shoulders to wrists
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [24, 26], [25, 27], [26, 28] // Hips to ankles
  ];
});


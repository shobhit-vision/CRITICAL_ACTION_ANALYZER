import { poseHistory, MAX_HISTORY, charts } from './ui.js';

// Initialize Charts
function initializeCharts() {
  const angleCtx = document.getElementById('angle-chart').getContext('2d');
  charts.angle = new Chart(angleCtx, {
    type: 'line',
    data: {
      labels: Array(MAX_HISTORY).fill(''),
      datasets: [
        {
          label: 'Left Knee Angle',
          data: [],
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Right Knee Angle',
          data: [],
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Left Elbow Angle',
          data: [],
          borderColor: 'rgb(255, 205, 86)',
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Right Elbow Angle',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Joint Angles Over Time'
        },
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 180,
          title: {
            display: true,
            text: 'Angle (degrees)'
          }
        }
      }
    }
  });

  const movementCtx = document.getElementById('movement-chart').getContext('2d');
  charts.movement = new Chart(movementCtx, {
    type: 'line',
    data: {
      labels: Array(MAX_HISTORY).fill(''),
      datasets: [
        {
          label: 'Torso Movement',
          data: [],
          borderColor: 'rgb(153, 102, 255)',
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Head Movement',
          data: [],
          borderColor: 'rgb(255, 159, 64)',
          tension: 0.1,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Body Movement Intensity'
        },
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Movement Intensity'
          }
        }
      }
    }
  });

  const velocityCtx = document.getElementById('velocity-chart').getContext('2d');
  charts.velocity = new Chart(velocityCtx, {
    type: 'line',
    data: {
      labels: Array(MAX_HISTORY).fill(''),
      datasets: [
        {
          label: 'Hand Velocity',
          data: [],
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
          borderWidth: 2
        },
        {
          label: 'Feet Velocity',
          data: [],
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Velocity of Extremities'
        },
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Velocity'
          }
        }
      }
    }
  });

  const stabilityCtx = document.getElementById('stability-chart').getContext('2d');
  charts.stability = new Chart(stabilityCtx, {
    type: 'line',
    data: {
      labels: Array(MAX_HISTORY).fill(''),
      datasets: [
        {
          label: 'Balance Stability',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          borderWidth: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Balance Stability Score'
        },
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Stability (%)'
          }
        }
      }
    }
  });
}

// Update charts with new data
function updateCharts(analysis) {
  if (!analysis) return;
  
  // Update angle chart
  charts.angle.data.datasets[0].data.push(analysis.angles.leftKnee);
  charts.angle.data.datasets[1].data.push(analysis.angles.rightKnee);
  charts.angle.data.datasets[2].data.push(analysis.angles.leftElbow);
  charts.angle.data.datasets[3].data.push(analysis.angles.rightElbow);
  
  // Update movement chart (simplified for demo)
  charts.movement.data.datasets[0].data.push(100 - analysis.torsoStability);
  charts.movement.data.datasets[1].data.push(100 - analysis.balance);
  
  // Update velocity chart (simplified for demo)
  if (poseHistory.length > 1) {
    const prevAnalysis = poseHistory[poseHistory.length - 2];
    const timeDiff = (analysis.timestamp - prevAnalysis.timestamp) / 1000;
    
    // Simplified velocity calculation
    const handVelocity = Math.abs(analysis.angles.leftElbow - prevAnalysis.angles.leftElbow) / timeDiff;
    const feetVelocity = Math.abs(analysis.angles.leftKnee - prevAnalysis.angles.leftKnee) / timeDiff;
    
    charts.velocity.data.datasets[0].data.push(handVelocity);
    charts.velocity.data.datasets[1].data.push(feetVelocity);
  } else {
    charts.velocity.data.datasets[0].data.push(0);
    charts.velocity.data.datasets[1].data.push(0);
  }
  
  // Update stability chart
  charts.stability.data.datasets[0].data.push(analysis.balance);
  
  // Limit data to max history
  Object.values(charts).forEach(chart => {
    chart.data.datasets.forEach(dataset => {
      if (dataset.data.length > MAX_HISTORY) {
        dataset.data.shift();
      }
    });
  });
  
  // Update charts
  Object.values(charts).forEach(chart => chart.update('none'));
}

export {
  initializeCharts,
  updateCharts
};
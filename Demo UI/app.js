// Application Data
const appData = {
  "user_profile": {
    "name": "David Strong",
    "age": 28,
    "weight_kg": 75,
    "height_cm": 175,
    "gender": "male",
    "fitness_goal": "weight_loss",
    "activity_level": "moderately_active"
  },
  "daily_metrics": {
    "bmr": 1784,
    "tdee": 2765,
    "target_calories": 2265,
    "calories_burned": 1847,
    "workout_time": 135
  },
  "workout_summary": {
    "total_time_minutes": 135,
    "total_energy_wh": 390.0,
    "sessions_today": 5,
    "avg_watts": 162
  },
  "rewards": {
    "fitness_points": 1350,
    "energy_points": 1950,
    "total_points": 3300,
    "level": "Gold",
    "next_level_points": 5000
  },
  "equipment_data": [
    {
      "equipment": "treadmill",
      "display_name": "Treadmill",
      "duration_minutes": 30,
      "energy_wh": 125.0,
      "watts_generated": 250,
      "status": "idle",
      "calories_burned": 420
    },
    {
      "equipment": "stationary_bike", 
      "display_name": "Stationary Bike",
      "duration_minutes": 45,
      "energy_wh": 135.0,
      "watts_generated": 180,
      "status": "active",
      "calories_burned": 540
    },
    {
      "equipment": "elliptical",
      "display_name": "Elliptical",
      "duration_minutes": 25,
      "energy_wh": 41.7,
      "watts_generated": 100,
      "status": "idle", 
      "calories_burned": 312
    },
    {
      "equipment": "rowing_machine",
      "display_name": "Rowing Machine",
      "duration_minutes": 20,
      "energy_wh": 73.3,
      "watts_generated": 220,
      "status": "idle",
      "calories_burned": 380
    },
    {
      "equipment": "pull_up_machine",
      "display_name": "Pull-up Machine",
      "duration_minutes": 15,
      "energy_wh": 15.0,
      "watts_generated": 60,
      "status": "idle",
      "calories_burned": 195
    }
  ],
  "energy_timeline": [
    {"time": "09:00", "watts": 0},
    {"time": "09:30", "watts": 250},
    {"time": "10:00", "watts": 180},
    {"time": "10:30", "watts": 100},
    {"time": "11:00", "watts": 220},
    {"time": "11:30", "watts": 60},
    {"time": "12:00", "watts": 0}
  ],
  "achievements": [
    {"name": "Energy Generator", "description": "Generated 300+ Wh in a day", "earned": true, "icon": "⚡"},
    {"name": "Gold Status", "description": "Reached 3000+ reward points", "earned": true, "icon": "🏆"},
    {"name": "Calorie Crusher", "description": "Burned 1500+ calories", "earned": true, "icon": "🔥"},
    {"name": "Equipment Master", "description": "Used 5+ different machines", "earned": true, "icon": "🏋️"}
  ]
};

// Chart instance
let energyChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    updateCurrentTime();
    renderEquipmentList();
    renderAchievements();
    initializeEnergyChart();
    startRealTimeUpdates();

    // Add event listeners
    document.querySelector('.redeem-btn').addEventListener('click', redeemRewards);

    console.log('PowerGym Dashboard initialized successfully!');
}

function updateCurrentTime() {
    const now = new Date();
    const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('currentTime').textContent = now.toLocaleDateString('en-US', options);
}

function renderEquipmentList() {
    const container = document.getElementById('equipmentList');
    container.innerHTML = '';

    appData.equipment_data.forEach(equipment => {
        const equipmentItem = document.createElement('div');
        equipmentItem.className = `equipment-item ${equipment.status}`;

        equipmentItem.innerHTML = `
            <div class="equipment-info">
                <h4>${equipment.display_name}</h4>
                <div class="equipment-stats">
                    ${equipment.duration_minutes}min • ${equipment.energy_wh}Wh • ${equipment.calories_burned}cal
                </div>
            </div>
            <div class="equipment-status">
                <span class="status-indicator ${equipment.status}">
                    ${equipment.status.toUpperCase()}
                </span>
                <div class="watts-display">${equipment.watts_generated}W</div>
            </div>
        `;

        container.appendChild(equipmentItem);
    });
}

function renderAchievements() {
    const container = document.getElementById('achievementList');
    container.innerHTML = '';

    appData.achievements.forEach(achievement => {
        const achievementItem = document.createElement('div');
        achievementItem.className = 'achievement-item';

        achievementItem.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-info">
                <h4>${achievement.name}</h4>
                <p>${achievement.description}</p>
            </div>
        `;

        container.appendChild(achievementItem);
    });
}

function initializeEnergyChart() {
    const ctx = document.getElementById('energyChart').getContext('2d');

    energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: appData.energy_timeline.map(point => point.time),
            datasets: [{
                label: 'Energy Generated (Watts)',
                data: appData.energy_timeline.map(point => point.watts),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#22c55e',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Power: ${context.parsed.y}W`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666',
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return value + 'W';
                        }
                    },
                    beginAtZero: true
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

function startRealTimeUpdates() {
    // Update time every minute
    setInterval(updateCurrentTime, 60000);

    // Simulate real-time data updates every 5 seconds
    setInterval(() => {
        simulateDataUpdate();
        updateChartData();
    }, 5000);
}

function simulateDataUpdate() {
    // Simulate equipment status changes
    appData.equipment_data.forEach(equipment => {
        if (Math.random() < 0.1) { // 10% chance to change status
            equipment.status = equipment.status === 'active' ? 'idle' : 'active';
        }

        // Update watts for active equipment
        if (equipment.status === 'active') {
            equipment.watts_generated = Math.floor(equipment.watts_generated * (0.9 + Math.random() * 0.2));
        }
    });

    // Update total energy
    const totalWatts = appData.equipment_data
        .filter(eq => eq.status === 'active')
        .reduce((sum, eq) => sum + eq.watts_generated, 0);

    // Add new data point to timeline
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');

    appData.energy_timeline.push({
        time: timeString,
        watts: totalWatts
    });

    // Keep only last 10 data points
    if (appData.energy_timeline.length > 10) {
        appData.energy_timeline.shift();
    }

    // Re-render equipment list
    renderEquipmentList();
}

function updateChartData() {
    if (energyChart) {
        energyChart.data.labels = appData.energy_timeline.map(point => point.time);
        energyChart.data.datasets[0].data = appData.energy_timeline.map(point => point.watts);
        energyChart.update('none'); // Update without animation for smooth real-time updates
    }
}

function redeemRewards() {
    const totalPoints = appData.rewards.total_points;

    if (totalPoints >= 100) {
        alert(`🎉 Congratulations! You're redeeming ${totalPoints} points!\n\nAvailable rewards:\n• Free protein shake (100 points)\n• Guest pass (500 points)\n• Personal training session (1000 points)\n• Monthly membership discount (2000 points)`);

        // Animate the button
        const btn = document.querySelector('.redeem-btn');
        btn.classList.add('pulse');
        setTimeout(() => btn.classList.remove('pulse'), 2000);
    } else {
        alert('You need at least 100 points to redeem rewards. Keep working out to earn more!');
    }
}

// Utility function to format numbers
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

// Add smooth scrolling for navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();

        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to clicked item
        this.parentElement.classList.add('active');

        // Here you could add routing logic for different sections
    });
});

// Add hover effects and animations
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

console.log('PowerGym Dashboard loaded successfully!');
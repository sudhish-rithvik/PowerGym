// PowerGym Hardware-Integrated Dashboard
// Connects to ESP32 via WiFi for real-time sensor data

class HardwareDashboard {
    constructor() {
        this.esp32IP = '192.168.1.100'; // Default ESP32 IP (will be auto-detected)
        this.isConnected = false;
        this.updateInterval = 1000; // 1 second updates
        this.updateTimer = null;
        this.energyChart = null;

        // Real-time data storage
        this.sensorData = {
            equipment: [],
            totalEnergy: 0,
            currentPower: 0,
            lastUpdate: 0
        };

        // User fitness tracking
        this.fitnessData = {
            startTime: Date.now(),
            activeTime: 0,
            caloriesBurned: 0,
            fitnessPoints: 0,
            energyPoints: 0,
            totalPoints: 0
        };

        // User profile for calculations
        this.userProfile = {
            name: "David Strong",
            age: 28,
            weight: 75,
            height: 175,
            gender: "male",
            goal: "weight_loss"
        };

        this.init();
    }

    init() {
        console.log('Initializing PowerGym Hardware Dashboard...');
        this.updateCurrentTime();
        this.initializeEnergyChart();
        this.setupEventListeners();
        this.detectESP32();

        // Start update timer
        setInterval(() => this.updateCurrentTime(), 60000);

        console.log('Dashboard initialized. Searching for ESP32...');
    }

    async detectESP32() {
        const possibleIPs = [
            '192.168.1.100', '192.168.1.101', '192.168.1.102',
            '192.168.0.100', '192.168.0.101', '192.168.0.102',
            '10.0.0.100', '10.0.0.101'
        ];

        this.updateConnectionStatus('🔍 Searching for ESP32...', 'searching');

        for (let ip of possibleIPs) {
            try {
                const response = await fetch(`http://${ip}/api/status`, {
                    method: 'GET',
                    timeout: 2000
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.system === 'PowerGym Monitor') {
                        this.esp32IP = ip;
                        this.connectToHardware();
                        return;
                    }
                }
            } catch (error) {
                // Continue searching
                console.log(`ESP32 not found at ${ip}`);
            }
        }

        this.updateConnectionStatus('🔴 ESP32 Not Found', 'disconnected');
        setTimeout(() => this.detectESP32(), 10000); // Retry every 10 seconds
    }

    async connectToHardware() {
        try {
            const response = await fetch(`http://${this.esp32IP}/api/status`);
            const statusData = await response.json();

            this.isConnected = true;
            this.updateConnectionStatus('🟢 Hardware Connected', 'connected');
            document.getElementById('ipAddress').textContent = `ESP32: ${this.esp32IP}`;

            // Update system status
            document.getElementById('esp32Status').textContent = 'Connected';
            document.getElementById('wifiSignal').textContent = 'Strong';
            document.getElementById('systemUptime').textContent = this.formatUptime(statusData.uptime);

            // Start real-time data updates
            this.startDataUpdates();

        } catch (error) {
            console.error('Failed to connect to ESP32:', error);
            this.isConnected = false;
            this.updateConnectionStatus('🔴 Connection Failed', 'error');

            // Retry connection
            setTimeout(() => this.detectESP32(), 5000);
        }
    }

    startDataUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(async () => {
            if (this.isConnected) {
                await this.fetchSensorData();
                await this.fetchEquipmentData();
                this.updateDashboard();
                this.calculateRewards();
            }
        }, this.updateInterval);

        console.log('Started real-time data updates');
    }

    async fetchSensorData() {
        try {
            const response = await fetch(`http://${this.esp32IP}/api/energy`);
            const data = await response.json();

            this.sensorData.totalEnergy = data.total_energy || 0;
            this.sensorData.currentPower = data.energy_data.reduce((sum, eq) => sum + eq.power, 0);
            this.sensorData.lastUpdate = Date.now();

            // Update energy chart
            this.updateEnergyChart(data.energy_data);

        } catch (error) {
            console.error('Failed to fetch sensor data:', error);
            this.handleConnectionError();
        }
    }

    async fetchEquipmentData() {
        try {
            const response = await fetch(`http://${this.esp32IP}/api/equipment`);
            const data = await response.json();

            this.sensorData.equipment = data.equipment || [];
            this.updateEquipmentDisplay();
            this.updateSensorReadings();

        } catch (error) {
            console.error('Failed to fetch equipment data:', error);
            this.handleConnectionError();
        }
    }

    updateDashboard() {
        // Update energy display
        document.getElementById('totalEnergyLive').textContent = `${this.sensorData.totalEnergy.toFixed(1)} Wh`;
        document.getElementById('currentPower').textContent = `${this.sensorData.currentPower.toFixed(0)} W`;

        // Update last update time
        const lastUpdate = new Date(this.sensorData.lastUpdate);
        document.getElementById('lastUpdate').textContent = `Last: ${lastUpdate.toLocaleTimeString()}`;

        // Update active equipment count
        const activeCount = this.sensorData.equipment.filter(eq => eq.active).length;
        document.getElementById('activeEquipment').textContent = activeCount.toString();

        // Calculate active workout time
        const activeTime = this.calculateActiveTime();
        document.getElementById('activeTime').textContent = `${activeTime} min`;

        // Update fitness metrics
        this.updateFitnessMetrics();
    }

    updateSensorReadings() {
        if (this.sensorData.equipment.length === 0) return;

        // Update speed sensors
        const speedReadings = this.sensorData.equipment.map((eq, i) => {
            const labels = ['T', 'B', 'E', 'R'];
            return `${labels[i]}: ${eq.rpm || 0} RPM`;
        });
        document.getElementById('speedSensors').innerHTML = speedReadings.map(reading => 
            `<span>${reading}</span>`
        ).join('');

        // Update load cells (average weight)
        const avgWeight = this.sensorData.equipment.reduce((sum, eq) => sum + (eq.weight || 0), 0) / this.sensorData.equipment.length;
        document.getElementById('loadCells').innerHTML = `
            <span>Weight: ${avgWeight.toFixed(1)} kg</span>
            <span>Force: ${(avgWeight * 9.81).toFixed(1)} N</span>
        `;

        // Update power measurement
        const totalVoltage = this.sensorData.equipment.reduce((sum, eq) => sum + (eq.voltage || 0), 0);
        const totalCurrent = this.sensorData.equipment.reduce((sum, eq) => sum + (eq.current || 0), 0);
        document.getElementById('powerMeasurement').innerHTML = `
            <span>V: ${totalVoltage.toFixed(1)}V</span>
            <span>I: ${totalCurrent.toFixed(2)}A</span>
            <span>P: ${this.sensorData.currentPower.toFixed(1)}W</span>
        `;
    }

    updateEquipmentDisplay() {
        const container = document.getElementById('equipmentList');
        container.innerHTML = '';

        this.sensorData.equipment.forEach((equipment, index) => {
            const equipmentItem = document.createElement('div');
            equipmentItem.className = `equipment-item ${equipment.active ? 'active' : 'idle'}`;

            equipmentItem.innerHTML = `
                <div class="equipment-info">
                    <h4>${equipment.name}</h4>
                    <div class="equipment-stats">
                        ${equipment.rpm}RPM • ${(equipment.energy || 0).toFixed(1)}Wh • ${(equipment.power || 0).toFixed(0)}W
                    </div>
                    <div class="sensor-details">
                        Weight: ${(equipment.weight || 0).toFixed(1)}kg | V: ${(equipment.voltage || 0).toFixed(1)}V | I: ${(equipment.current || 0).toFixed(2)}A
                    </div>
                </div>
                <div class="equipment-status">
                    <span class="status-indicator ${equipment.active ? 'active' : 'idle'}">
                        ${equipment.active ? 'ACTIVE' : 'IDLE'}
                    </span>
                    <div class="watts-display">${(equipment.power || 0).toFixed(0)}W</div>
                </div>
            `;

            container.appendChild(equipmentItem);
        });
    }

    calculateActiveTime() {
        // Calculate time since any equipment has been active
        const now = Date.now();
        const activeEquipment = this.sensorData.equipment.filter(eq => eq.active);

        if (activeEquipment.length > 0) {
            this.fitnessData.activeTime = Math.floor((now - this.fitnessData.startTime) / 60000);
        }

        return this.fitnessData.activeTime;
    }

    updateFitnessMetrics() {
        // Calculate BMR using Mifflin-St Jeor equation
        const bmr = this.calculateBMR();
        document.getElementById('bmrValue').textContent = `${bmr.toFixed(0)} cal/day`;

        // Calculate real-time calories burned
        const caloriesBurned = this.calculateCaloriesBurned();
        const targetCalories = Math.floor(bmr * 1.55 - 500); // Weight loss goal
        document.getElementById('liveCalories').textContent = `${caloriesBurned} / ${targetCalories}`;

        // Update progress bar
        const calorieProgress = Math.min((caloriesBurned / targetCalories) * 100, 100);
        document.getElementById('caloriesProgress').style.width = `${calorieProgress}%`;

        // Update heart rate zone based on power output
        const heartZone = this.calculateHeartRateZone();
        document.getElementById('heartZone').textContent = heartZone;
    }

    calculateBMR() {
        const { age, weight, height, gender } = this.userProfile;
        if (gender === 'male') {
            return 66.47 + (13.75 * weight) + (5.003 * height) - (6.755 * age);
        } else {
            return 655.1 + (9.563 * weight) + (1.850 * height) - (4.676 * age);
        }
    }

    calculateCaloriesBurned() {
        const activeTime = this.fitnessData.activeTime / 60; // Convert to hours
        const avgPower = this.sensorData.currentPower;

        // Estimate calories based on power output and time
        // Approximate: 1 Watt ≈ 0.86 calories/hour
        const powerCalories = avgPower * 0.86 * activeTime;

        // Add METs-based calculation for active equipment
        const metsCalories = this.sensorData.equipment.reduce((total, eq) => {
            if (!eq.active) return total;

            const mets = this.getEquipmentMETs(eq.name);
            return total + (mets * this.userProfile.weight * activeTime);
        }, 0);

        return Math.floor(Math.max(powerCalories, metsCalories));
    }

    getEquipmentMETs(equipmentName) {
        const metsTable = {
            'Treadmill': 8.5,
            'Stationary_Bike': 7.0,
            'Elliptical': 6.0,
            'Rowing_Machine': 8.0
        };
        return metsTable[equipmentName] || 5.0;
    }

    calculateHeartRateZone() {
        const avgPower = this.sensorData.currentPower;

        if (avgPower < 50) return 'Rest';
        if (avgPower < 150) return 'Light';
        if (avgPower < 300) return 'Moderate';
        if (avgPower < 500) return 'Vigorous';
        return 'Maximum';
    }

    calculateRewards() {
        // Fitness points: 10 points per minute of active time
        this.fitnessData.fitnessPoints = this.fitnessData.activeTime * 10;

        // Energy points: 5 points per Wh generated
        this.fitnessData.energyPoints = Math.floor(this.sensorData.totalEnergy * 5);

        // Total points
        this.fitnessData.totalPoints = this.fitnessData.fitnessPoints + this.fitnessData.energyPoints;

        // Update display
        document.getElementById('liveFreeness').textContent = this.fitnessData.fitnessPoints.toString();
        document.getElementById('liveEnergyPoints').textContent = this.fitnessData.energyPoints.toString();
        document.getElementById('liveTotalPoints').textContent = this.fitnessData.totalPoints.toString();

        // Update level and progress
        this.updateLevel();

        // Update redeem button
        const redeemBtn = document.getElementById('redeemBtn');
        redeemBtn.textContent = `Redeem Rewards (${this.fitnessData.totalPoints} pts)`;
        redeemBtn.disabled = this.fitnessData.totalPoints < 100;
    }

    updateLevel() {
        let level = 'Bronze';
        let nextLevel = 'Silver';
        let nextLevelPoints = 1000;
        let progress = 0;

        if (this.fitnessData.totalPoints >= 5000) {
            level = 'Platinum';
            nextLevel = 'Diamond';
            nextLevelPoints = 10000;
        } else if (this.fitnessData.totalPoints >= 3000) {
            level = 'Gold';
            nextLevel = 'Platinum';
            nextLevelPoints = 5000;
        } else if (this.fitnessData.totalPoints >= 1000) {
            level = 'Silver';
            nextLevel = 'Gold';
            nextLevelPoints = 3000;
        }

        progress = (this.fitnessData.totalPoints / nextLevelPoints) * 100;

        document.getElementById('currentLevel').textContent = level;
        document.getElementById('currentLevel').className = `level-badge ${level.toLowerCase()}`;
        document.getElementById('progressText').textContent = `Progress to ${nextLevel}: ${this.fitnessData.totalPoints} / ${nextLevelPoints}`;
        document.getElementById('levelProgress').style.width = `${Math.min(progress, 100)}%`;
    }

    initializeEnergyChart() {
        const ctx = document.getElementById('energyChart').getContext('2d');

        this.energyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Power Generation (Watts)',
                    data: [],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#22c55e',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#22c55e',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `Power: ${context.parsed.y}W`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: { color: '#666' }
                    },
                    y: {
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            color: '#666',
                            callback: function(value) { return value + 'W'; }
                        },
                        beginAtZero: true
                    }
                },
                animation: { duration: 500 }
            }
        });
    }

    updateEnergyChart(energyData) {
        if (!this.energyChart || !energyData) return;

        const now = new Date();
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0') + ':' +
                         now.getSeconds().toString().padStart(2, '0');

        const totalPower = energyData.reduce((sum, eq) => sum + (eq.power || 0), 0);

        this.energyChart.data.labels.push(timeLabel);
        this.energyChart.data.datasets[0].data.push(totalPower);

        // Keep only last 30 data points
        if (this.energyChart.data.labels.length > 30) {
            this.energyChart.data.labels.shift();
            this.energyChart.data.datasets[0].data.shift();
        }

        this.energyChart.update('none');
    }

    updateConnectionStatus(message, status) {
        const statusElement = document.getElementById('hardwareStatus');
        const alertElement = document.getElementById('connectionAlert');

        statusElement.textContent = message;
        statusElement.className = `hardware-status ${status}`;

        if (status === 'connected') {
            alertElement.style.display = 'none';
        } else {
            alertElement.style.display = 'flex';
            alertElement.querySelector('span').textContent = message;
        }
    }

    handleConnectionError() {
        this.isConnected = false;
        this.updateConnectionStatus('🔴 Connection Lost', 'disconnected');

        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }

        // Attempt to reconnect
        setTimeout(() => this.detectESP32(), 3000);
    }

    updateCurrentTime() {
        const now = new Date();
        const options = { 
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        };
        document.getElementById('currentTime').textContent = now.toLocaleDateString('en-US', options);
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    setupEventListeners() {
        // Global functions for HTML onclick events
        window.connectToHardware = () => this.detectESP32();
        window.redeemRewards = () => this.redeemRewards();
        window.calibrateSensors = () => this.calibrateSensors();
        window.resetEnergyData = () => this.resetEnergyData();
        window.exportData = () => this.exportData();
    }

    redeemRewards() {
        if (this.fitnessData.totalPoints < 100) {
            alert('You need at least 100 points to redeem rewards!');
            return;
        }

        const rewards = [
            { name: 'Free Protein Shake', points: 100 },
            { name: 'Guest Day Pass', points: 500 },
            { name: 'Personal Training Session', points: 1000 },
            { name: 'Monthly Membership Discount', points: 2000 },
            { name: 'Fitness Equipment Rental', points: 3000 }
        ];

        let rewardsList = 'Available Rewards:\n\n';
        rewards.forEach(reward => {
            if (this.fitnessData.totalPoints >= reward.points) {
                rewardsList += `✅ ${reward.name} (${reward.points} points)\n`;
            } else {
                rewardsList += `❌ ${reward.name} (${reward.points} points)\n`;
            }
        });

        alert(`🎉 Total Points: ${this.fitnessData.totalPoints}\n\n${rewardsList}\nContact front desk to redeem!`);
    }

    async calibrateSensors() {
        if (!this.isConnected) {
            alert('Please connect to ESP32 hardware first!');
            return;
        }

        const confirmation = confirm('This will recalibrate all sensors. Make sure no equipment is in use. Continue?');
        if (!confirmation) return;

        try {
            // Send calibration command to ESP32
            const response = await fetch(`http://${this.esp32IP}/api/calibrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'calibrate_all' })
            });

            if (response.ok) {
                alert('Sensor calibration started. Please wait 30 seconds...');
            } else {
                alert('Calibration failed. Check hardware connection.');
            }
        } catch (error) {
            console.error('Calibration error:', error);
            alert('Calibration failed. Check network connection.');
        }
    }

    resetEnergyData() {
        if (this.energyChart) {
            this.energyChart.data.labels = [];
            this.energyChart.data.datasets[0].data = [];
            this.energyChart.update();
        }

        // Reset fitness tracking
        this.fitnessData.startTime = Date.now();
        this.fitnessData.activeTime = 0;
        this.fitnessData.caloriesBurned = 0;
        this.fitnessData.fitnessPoints = 0;
        this.fitnessData.energyPoints = 0;
        this.fitnessData.totalPoints = 0;

        alert('Energy data and fitness tracking reset!');
    }

    exportData() {
        const csvData = [
            ['Timestamp', 'Equipment', 'Power (W)', 'Energy (Wh)', 'RPM', 'Weight (kg)'],
            ...this.sensorData.equipment.map(eq => [
                new Date().toISOString(),
                eq.name,
                eq.power || 0,
                eq.energy || 0,
                eq.rpm || 0,
                eq.weight || 0
            ])
        ];

        const csvContent = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `powergym_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        window.URL.revokeObjectURL(url);
    }
}

// Initialize the hardware-integrated dashboard
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new HardwareDashboard();
    console.log('PowerGym Hardware Dashboard initialized!');
});
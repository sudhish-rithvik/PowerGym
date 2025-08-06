/*
  PowerGym Equipment Monitoring System
  Hardware Integration: Speed Sensors, Weight Sensors, Power Measurement
  MCU: ESP32 Development Board

  Sensors:
  - IR Speed Sensors (Digital pins)
  - Load Cell Weight Sensors (Analog pins via HX711)
  - Current/Voltage sensors for power measurement

  Communication:
  - WiFi connectivity for real-time data transmission
  - Web dashboard integration
*/

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HX711.h>
#include <EEPROM.h>

// WiFi Configuration
const char* ssid = "PowerGym_Network";
const char* password = "GymEnergy2025";

// Hardware Pin Definitions
#define TREADMILL_SPEED_PIN    2
#define BIKE_SPEED_PIN         4
#define ELLIPTICAL_SPEED_PIN   5
#define ROWING_SPEED_PIN       18

// Load Cell Pins (HX711 amplifier)
#define LOADCELL_DOUT_PIN      19
#define LOADCELL_SCK_PIN       21

// Power Measurement Pins
#define VOLTAGE_SENSOR_PIN     A0
#define CURRENT_SENSOR_PIN     A1

// LED Status Indicators
#define STATUS_LED_PIN         23
#define POWER_LED_PIN          22

// Global Variables
HX711 scale;
WebServer server(80);

// Equipment Data Structure
struct EquipmentData {
  String name;
  float speed_rpm;
  float weight_kg;
  float voltage;
  float current;
  float power_watts;
  float energy_wh;
  unsigned long last_update;
  bool is_active;
};

EquipmentData equipment[4] = {
  {"Treadmill", 0, 0, 0, 0, 0, 0, 0, false},
  {"Stationary_Bike", 0, 0, 0, 0, 0, 0, 0, false},
  {"Elliptical", 0, 0, 0, 0, 0, 0, 0, false},
  {"Rowing_Machine", 0, 0, 0, 0, 0, 0, 0, false}
};

// Speed Measurement Variables
volatile unsigned long pulse_count[4] = {0, 0, 0, 0};
unsigned long last_measurement_time[4] = {0, 0, 0, 0};
const unsigned long measurement_interval = 1000; // 1 second

// Power Generation Variables
float total_energy_generated = 0;
unsigned long last_energy_update = 0;

// User Profile for Fitness Calculations
struct UserProfile {
  String name;
  int age;
  float weight_kg;
  float height_cm;
  String gender;
  String fitness_goal;
};

UserProfile user = {"David Strong", 28, 75.0, 175.0, "male", "weight_loss"};

void setup() {
  Serial.begin(115200);
  Serial.println("PowerGym Equipment Monitor Starting...");

  // Initialize pins
  pinMode(TREADMILL_SPEED_PIN, INPUT_PULLUP);
  pinMode(BIKE_SPEED_PIN, INPUT_PULLUP);
  pinMode(ELLIPTICAL_SPEED_PIN, INPUT_PULLUP);
  pinMode(ROWING_SPEED_PIN, INPUT_PULLUP);

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(POWER_LED_PIN, OUTPUT);

  // Initialize Load Cell
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(2280.f); // Calibration factor
  scale.tare(); // Reset to zero

  // Interrupt attachments for speed sensors
  attachInterrupt(digitalPinToInterrupt(TREADMILL_SPEED_PIN), treadmill_pulse, FALLING);
  attachInterrupt(digitalPinToInterrupt(BIKE_SPEED_PIN), bike_pulse, FALLING);
  attachInterrupt(digitalPinToInterrupt(ELLIPTICAL_SPEED_PIN), elliptical_pulse, FALLING);
  attachInterrupt(digitalPinToInterrupt(ROWING_SPEED_PIN), rowing_pulse, FALLING);

  // Initialize WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  }

  Serial.println("WiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(STATUS_LED_PIN, HIGH);

  // Initialize web server
  setupWebServer();
  server.begin();

  Serial.println("PowerGym Monitor Ready!");
}

void loop() {
  server.handleClient();

  // Update equipment measurements every second
  unsigned long current_time = millis();

  for(int i = 0; i < 4; i++) {
    if(current_time - last_measurement_time[i] >= measurement_interval) {
      updateEquipmentData(i);
      last_measurement_time[i] = current_time;
    }
  }

  // Update total energy every 5 seconds
  if(current_time - last_energy_update >= 5000) {
    calculateTotalEnergy();
    last_energy_update = current_time;
  }

  // Status LED blink to show system is running
  static unsigned long led_blink = 0;
  if(current_time - led_blink >= 2000) {
    digitalWrite(POWER_LED_PIN, !digitalRead(POWER_LED_PIN));
    led_blink = current_time;
  }

  delay(100);
}

// Interrupt Service Routines for Speed Sensors
void IRAM_ATTR treadmill_pulse() { pulse_count[0]++; }
void IRAM_ATTR bike_pulse() { pulse_count[1]++; }
void IRAM_ATTR elliptical_pulse() { pulse_count[2]++; }
void IRAM_ATTR rowing_pulse() { pulse_count[3]++; }

void updateEquipmentData(int equipment_index) {
  // Calculate RPM from pulse count
  float rpm = (pulse_count[equipment_index] * 60.0) / (measurement_interval / 1000.0);
  pulse_count[equipment_index] = 0; // Reset counter

  equipment[equipment_index].speed_rpm = rpm;
  equipment[equipment_index].is_active = (rpm > 5); // Active if RPM > 5

  if(equipment[equipment_index].is_active) {
    // Read weight/resistance from load cell
    if(scale.is_ready()) {
      float weight = scale.get_units(3); // Average of 3 readings
      equipment[equipment_index].weight_kg = abs(weight);
    }

    // Read power generation
    float voltage = (analogRead(VOLTAGE_SENSOR_PIN) * 48.0) / 4095.0; // Convert to 0-48V
    float current = ((analogRead(CURRENT_SENSOR_PIN) - 2048) * 20.0) / 4095.0; // ACS712 sensor

    equipment[equipment_index].voltage = voltage;
    equipment[equipment_index].current = abs(current);
    equipment[equipment_index].power_watts = voltage * abs(current);

    // Integrate energy (Wh = Watts * hours)
    float time_hours = measurement_interval / 3600000.0;
    equipment[equipment_index].energy_wh += equipment[equipment_index].power_watts * time_hours;

  } else {
    // Equipment is idle
    equipment[equipment_index].power_watts = 0;
    equipment[equipment_index].current = 0;
    equipment[equipment_index].voltage = 0;
  }

  equipment[equipment_index].last_update = millis();
}

void calculateTotalEnergy() {
  total_energy_generated = 0;
  for(int i = 0; i < 4; i++) {
    total_energy_generated += equipment[i].energy_wh;
  }
}

float calculateBMR() {
  // Mifflin-St Jeor Equation for BMR calculation
  if(user.gender == "male") {
    return 66.47 + (13.75 * user.weight_kg) + (5.003 * user.height_cm) - (6.755 * user.age);
  } else {
    return 655.1 + (9.563 * user.weight_kg) + (1.850 * user.height_cm) - (4.676 * user.age);
  }
}

float calculateCaloriesBurned(int equipment_index) {
  // METs-based calorie calculation
  float mets = 0;
  float duration_hours = (millis() - equipment[equipment_index].last_update) / 3600000.0;

  switch(equipment_index) {
    case 0: mets = 8.5; break;  // Treadmill
    case 1: mets = 7.0; break;  // Stationary Bike
    case 2: mets = 6.0; break;  // Elliptical
    case 3: mets = 8.0; break;  // Rowing Machine
  }

  // Calories = METs × weight(kg) × duration(hours)
  return mets * user.weight_kg * duration_hours;
}

void setupWebServer() {
  // CORS headers for web dashboard access
  server.enableCORS(true);

  // Main dashboard data endpoint
  server.on("/api/dashboard", HTTP_GET, []() {
    DynamicJsonDocument doc(2048);

    // User profile data
    JsonObject userProfile = doc.createNestedObject("user_profile");
    userProfile["name"] = user.name;
    userProfile["age"] = user.age;
    userProfile["weight_kg"] = user.weight_kg;
    userProfile["height_cm"] = user.height_cm;

    // Fitness metrics
    JsonObject metrics = doc.createNestedObject("daily_metrics");
    metrics["bmr"] = calculateBMR();
    metrics["tdee"] = calculateBMR() * 1.55; // Moderate activity
    metrics["target_calories"] = calculateBMR() * 1.55 - 500; // Weight loss

    // Equipment data
    JsonArray equipmentArray = doc.createNestedArray("equipment_data");
    for(int i = 0; i < 4; i++) {
      JsonObject eq = equipmentArray.createNestedObject();
      eq["name"] = equipment[i].name;
      eq["speed_rpm"] = equipment[i].speed_rpm;
      eq["weight_kg"] = equipment[i].weight_kg;
      eq["power_watts"] = equipment[i].power_watts;
      eq["energy_wh"] = equipment[i].energy_wh;
      eq["status"] = equipment[i].is_active ? "active" : "idle";
      eq["calories_burned"] = calculateCaloriesBurned(i);
    }

    // Total energy and points
    JsonObject rewards = doc.createNestedObject("rewards");
    rewards["total_energy_wh"] = total_energy_generated;
    rewards["energy_points"] = (int)(total_energy_generated * 5); // 5 points per Wh
    rewards["fitness_points"] = 1350; // From workout time
    rewards["total_points"] = (int)(total_energy_generated * 5) + 1350;

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  // Real-time energy data endpoint
  server.on("/api/energy", HTTP_GET, []() {
    DynamicJsonDocument doc(1024);
    JsonArray energyArray = doc.createNestedArray("energy_data");

    for(int i = 0; i < 4; i++) {
      JsonObject eq = energyArray.createNestedObject();
      eq["equipment"] = equipment[i].name;
      eq["energy"] = equipment[i].energy_wh;
      eq["power"] = equipment[i].power_watts;
      eq["timestamp"] = equipment[i].last_update;
    }

    doc["total_energy"] = total_energy_generated;
    doc["timestamp"] = millis();

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  // Equipment status endpoint
  server.on("/api/equipment", HTTP_GET, []() {
    DynamicJsonDocument doc(1024);
    JsonArray equipmentArray = doc.createNestedArray("equipment");

    for(int i = 0; i < 4; i++) {
      JsonObject eq = equipmentArray.createNestedObject();
      eq["id"] = i;
      eq["name"] = equipment[i].name;
      eq["rpm"] = equipment[i].speed_rpm;
      eq["weight"] = equipment[i].weight_kg;
      eq["voltage"] = equipment[i].voltage;
      eq["current"] = equipment[i].current;
      eq["power"] = equipment[i].power_watts;
      eq["energy"] = equipment[i].energy_wh;
      eq["active"] = equipment[i].is_active;
      eq["last_update"] = equipment[i].last_update;
    }

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  // System status endpoint
  server.on("/api/status", HTTP_GET, []() {
    DynamicJsonDocument doc(512);
    doc["system"] = "PowerGym Monitor";
    doc["version"] = "1.0";
    doc["uptime"] = millis();
    doc["wifi_status"] = WiFi.status();
    doc["ip_address"] = WiFi.localIP().toString();
    doc["total_energy"] = total_energy_generated;
    doc["active_equipment"] = 0;

    for(int i = 0; i < 4; i++) {
      if(equipment[i].is_active) doc["active_equipment"] = (int)doc["active_equipment"] + 1;
    }

    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  Serial.println("Web server endpoints configured");
}
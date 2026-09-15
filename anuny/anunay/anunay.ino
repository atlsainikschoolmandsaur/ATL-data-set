/*
  Project: Smart Lab Guardian - Arduino Mega 2560
  Features: 
  - Dual L298N Motor Drivers
  - 270-Degree Front Ultrasonic Scanning Servo
  - 270-Degree MG90S Sorting Conveyor Gate Servo
  - Ultrasonic Bin-Level Capacity Protection
  - IR Detection & Inductive Metal Separation
  - Isolated Dual Relay Controls (Brush & Auxiliary)
*/

#include <Servo.h>

// --- Pin Definitions ---

// Motor Driver 1 (Left Wheels)
const int ENA_L = 2;
const int IN1_L = 22;
const int IN2_L = 23;
const int IN3_L = 24;
const int IN4_L = 25;
const int ENB_L = 3;

// Motor Driver 2 (Brush, Conveyor, Right Wheels)
const int ENA_R = 5;
const int IN1_R = 26;
const int IN2_R = 27;
const int IN3_R = 28;
const int IN4_R = 29;
const int ENB_R = 6;

// Direct Actuator & Relay Pins
const int BRUSH_RELAY_PIN = 7;  // Pin 7: Relay for Brush Motor ON/OFF
const int CONVEYOR_MOTOR_PWM = 10;
const int CONVEYOR_MOTOR_DIR = 31;
const int AUX_RELAY_PIN = 46;  // Pin 46: Main Aux Power / Accessory Relay

// Servos (Both 270-Degree Signal Capable)
Servo scanningServo;  // Pin 9 (270-Degree Front Scanner)
Servo sortingServo;   // Pin 8 (270-Degree MG90S Sorting Gate)
const int PIN_SCANNING_SERVO = 9;
const int PIN_SORTING_SERVO = 8;
 
// Ultrasonic Sensors
const int TRIG_SCANNING = 32;
const int ECHO_SCANNING = 33;
const int TRIG_BIN = 34;
const int ECHO_BIN = 35;

// Material & Zone Detection Sensors
const int IR_SENSOR_PIN = 36;
const int METAL_SENSOR_LEFT = 37;
const int METAL_SENSOR_RIGHT = 38;

// Status LEDs & Buzzers
const int LED_GREEN_PIN = 40;
const int LED_YELLOW_PIN = 41;
const int LED_RED_PIN = 42;
const int BUZZER_BIN_FULL = 43;  // B1: Bin Capacity Alert
const int BUZZER_OBSTACLE = 44;  // B2: Navigation / Obstacle Warning
const int BUZZER_SYSTEM = 45;    // B3: General System / Status Alert

// Dynamic Scanning Sweep Variables
int scanAngle = 135;     // Midpoint of 270-degree range
int scanDirection = 10;  // Sweep increment per loop

// Function Prototypes
long getDistance(int trigPin, int echoPin);
void set270ScanningAngle(int angleInDegrees);
void set270SortingAngle(int angleInDegrees);
void moveForward(int speed);
void moveBackward(int speed);
void stopRobot();
void startCleaningSystem();
void sortItem(int binChoice);

void setup() {
  Serial.begin(9600);
  Serial.println(F("--- Smart Lab Guardian Booting ---"));

  // 1. Initialize Drive & Actuator Output Pins
  pinMode(IN1_L, OUTPUT);
  pinMode(IN2_L, OUTPUT);
  pinMode(IN3_L, OUTPUT);
  pinMode(IN4_L, OUTPUT);
  pinMode(ENA_L, OUTPUT);
  pinMode(ENB_L, OUTPUT);

  pinMode(IN1_R, OUTPUT);
  pinMode(IN2_R, OUTPUT);
  pinMode(IN3_R, OUTPUT);
  pinMode(IN4_R, OUTPUT);
  pinMode(ENA_R, OUTPUT);
  pinMode(ENB_R, OUTPUT);

  pinMode(BRUSH_RELAY_PIN, OUTPUT);
  pinMode(AUX_RELAY_PIN, OUTPUT);
    digitalWrite(BRUSH_RELAY_PIN, HIGH);  // Default OFF (Active LOW Relay)
    digitalWrite(AUX_RELAY_PIN, LOW);     // Default ON (Aux Power Active)

    pinMode(CONVEYOR_MOTOR_PWM, OUTPUT);
    pinMode(CONVEYOR_MOTOR_DIR, OUTPUT);

    // 2. Initialize Sensor Pins
    pinMode(TRIG_SCANNING, OUTPUT);
    pinMode(ECHO_SCANNING, INPUT);
    pinMode(TRIG_BIN, OUTPUT);
    pinMode(ECHO_BIN, INPUT);
    pinMode(IR_SENSOR_PIN, INPUT);
    pinMode(METAL_SENSOR_LEFT, INPUT);
    pinMode(METAL_SENSOR_RIGHT, INPUT);

    // 3. Initialize Indicators & Buzzers
    pinMode(LED_GREEN_PIN, OUTPUT);
    pinMode(LED_YELLOW_PIN, OUTPUT);
    pinMode(LED_RED_PIN, OUTPUT);
    pinMode(BUZZER_BIN_FULL, OUTPUT);
    pinMode(BUZZER_OBSTACLE, OUTPUT);
    pinMode(BUZZER_SYSTEM, OUTPUT);

    // 4. Attach Servos with Microsecond Bounds (500us - 2500us for 270° capability)
    scanningServo.attach(PIN_SCANNING_SERVO, 500, 2500);
    sortingServo.attach(PIN_SORTING_SERVO, 500, 2500);

    // 5. Startup Self-Test & Calibration Routine
    Serial.println(F("Calibrating 270-Degree Servos..."));
    set270ScanningAngle(45);
    set270SortingAngle(45);
    delay(400);
    set270ScanningAngle(225);
    set270SortingAngle(225);
    delay(400);
    set270ScanningAngle(135);
    set270SortingAngle(135);
    delay(400);  // Set neutral midpoint

    // Audio Confirmation Signal
    digitalWrite(BUZZER_SYSTEM, HIGH);
    delay(150);
    digitalWrite(BUZZER_SYSTEM, LOW);
  }

  void loop() {
    // -------------------------------------------------------------
    // PHASE 1: Bin Level Capacity Safeguard
    // -------------------------------------------------------------
    long binDistance = getDistance(TRIG_BIN, ECHO_BIN);
    Serial.print(F("Bin Clearance: "));
    Serial.print(binDistance);
    Serial.println(F(" cm"));

    if (binDistance > 0 && binDistance < 3) {  // Bin full threshold (< 3 cm clearance)
      Serial.println(F("CRITICAL: Storage Bin Full! Operation Halted."));
      digitalWrite(LED_RED_PIN, HIGH);
      digitalWrite(BUZZER_BIN_FULL, HIGH);
      stopRobot();
      return;  // Freeze main loop execution until cleared
    } else {
      digitalWrite(LED_RED_PIN, LOW);
      digitalWrite(BUZZER_BIN_FULL, LOW);
    }

    // -------------------------------------------------------------
    // PHASE 2: 270-Degree Front Servo Sweep & Collision Avoidance
    // -------------------------------------------------------------
    scanAngle += scanDirection;
    if (scanAngle <= 30 || scanAngle >= 240) {  // Sweep bounds across 270° span
      scanDirection = -scanDirection;
    }
    set270ScanningAngle(scanAngle);

    long frontDistance = getDistance(TRIG_SCANNING, ECHO_SCANNING);
    Serial.print(F("Scan Angle: "));
    Serial.print(scanAngle);
    Serial.print(F("° | Distance: "));
    Serial.print(frontDistance);
    Serial.println(F(" cm"));

    if (frontDistance > 0 && frontDistance < 15) {  // Obstacle closer than 15 cm
      Serial.println(F("Obstacle Detected! Executing Evasion Routine."));
      stopRobot();
      digitalWrite(LED_YELLOW_PIN, HIGH);
      digitalWrite(BUZZER_OBSTACLE, HIGH);
      delay(200);
      digitalWrite(BUZZER_OBSTACLE, LOW);
      digitalWrite(LED_YELLOW_PIN, LOW);

      moveBackward(150);
      delay(500);
      stopRobot();
      return;
    } else {
      moveForward(180);
      startCleaningSystem();
    }

    // -------------------------------------------------------------
    // PHASE 3: Debris Detection & Material Classification
    // -------------------------------------------------------------
    bool irDetected = digitalRead(IR_SENSOR_PIN);

    if (irDetected == LOW) {  // Debris intercepted under IR sensor
      Serial.println(F("Debris Detected in Sorting Zone!"));
      stopRobot();  // Halt movement during gate operation

      bool metalLeft = digitalRead(METAL_SENSOR_LEFT);
      bool metalRight = digitalRead(METAL_SENSOR_RIGHT);

      if (metalLeft == LOW || metalRight == LOW) {  // Metal detected (Active LOW)
        Serial.println(F("Material: Metallic Component -> Route to Bin 1"));
        digitalWrite(LED_GREEN_PIN, HIGH);
        digitalWrite(BUZZER_SYSTEM, HIGH);

        sortItem(1);  // Divert to Component Recovery Bin

        digitalWrite(BUZZER_SYSTEM, LOW);
        digitalWrite(LED_GREEN_PIN, LOW);
      } else {
        Serial.println(F("Material: Waste/Scrap -> Route to Bin 2"));
        sortItem(2);  // Divert to General Waste Bin
      }
    }

    delay(30);  // Loop stability delay
  }

  // -------------------------------------------------------------
  // Helper Routines & Driving Controls
  // -------------------------------------------------------------

  // Non-blocking ultrasonic measurement with pulse timeout
  long getDistance(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // 25ms timeout prevents pulseIn lockups if sensor misses echo
    long duration = pulseIn(echoPin, HIGH, 25000);
    if (duration == 0) return 999;

    return (duration * 0.034 / 2);
  }

  // Controls 270-degree Scanning Servo via microsecond mapping
  void set270ScanningAngle(int angleInDegrees) {
    angleInDegrees = constrain(angleInDegrees, 0, 270);
    int pulseWidth = map(angleInDegrees, 0, 270, 500, 2500);
    scanningServo.writeMicroseconds(pulseWidth);
  }

  // Controls 270-degree MG90S Sorting Servo via microsecond mapping
  void set270SortingAngle(int angleInDegrees) {
    angleInDegrees = constrain(angleInDegrees, 0, 270);
    int pulseWidth = map(angleInDegrees, 0, 270, 500, 2500);
    sortingServo.writeMicroseconds(pulseWidth);
  }

  void moveForward(int speed) {
    digitalWrite(IN1_L, HIGH);
    digitalWrite(IN2_L, LOW);
    digitalWrite(IN3_L, HIGH);
    digitalWrite(IN4_L, LOW);
    analogWrite(ENA_L, speed);
    analogWrite(ENB_L, speed);

    digitalWrite(IN1_R, HIGH);
    digitalWrite(IN2_R, LOW);
    digitalWrite(IN3_R, HIGH);
    digitalWrite(IN4_R, LOW);
    analogWrite(ENA_R, speed);
    analogWrite(ENB_R, speed);
  }

  void moveBackward(int speed) {
    digitalWrite(IN1_L, LOW);
    digitalWrite(IN2_L, HIGH);
    digitalWrite(IN3_L, LOW);
    digitalWrite(IN4_L, HIGH);
    analogWrite(ENA_L, speed);
    analogWrite(ENB_L, speed);

    digitalWrite(IN1_R, LOW);
    digitalWrite(IN2_R, HIGH);
    digitalWrite(IN3_R, LOW);
    digitalWrite(IN4_R, HIGH);
    analogWrite(ENA_R, speed);
    analogWrite(ENB_R, speed);
  }

  void stopRobot() {
    analogWrite(ENA_L, 0);
    analogWrite(ENB_L, 0);
    analogWrite(ENA_R, 0);
    analogWrite(ENB_R, 0);
    digitalWrite(BRUSH_RELAY_PIN, HIGH);  // Turn off Brush Relay
    analogWrite(CONVEYOR_MOTOR_PWM, 0);
  }

  void startCleaningSystem() {
    digitalWrite(BRUSH_RELAY_PIN, LOW);  // Turn on Brush Relay (Active LOW)
    digitalWrite(CONVEYOR_MOTOR_DIR, HIGH);
    analogWrite(CONVEYOR_MOTOR_PWM, 200);
  }

void sortItem(int binChoice) {
  if (binChoice == 1) {
    set270SortingAngle(45);  // Position gate for Component Bin
  } else {
    set270SortingAngle(225);  // Position gate for Waste Bin
  }

  delay(1500);
  set270SortingAngle(135);  // Return gate to neutral midpoint (135°)
  delay(500);
}
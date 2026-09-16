/*
  Project: Smart Lab Guardian (Single Bin IR Update)
  - 1x L298N Driver (4 Hobby Motors)
  - 1x Relay (Brush & Conveyor)
  - SG90 (Scanning) & MG90S (Sorting) Servos
  - 1x IR Bin-Level Sensor, 1x IR Sorting Trigger, 1x Metal Sensor
  - Multi-tone Buzzer & LED Alerts
*/

#include <Servo.h>

// --- Pin Definitions ---

// Motor Driver (L298N for 4 Hobby Motors)
const int ENA = 2;
const int IN1 = 22;
const int IN2 = 23;
const int IN3 = 24;
const int IN4 = 25;
const int ENB = 3;

// Brush & Conveyor Relay
const int SYSTEM_RELAY_PIN = 7; 

// Servos
Servo scanningServo; // SG90 on Pin 9
Servo sortingServo;  // MG90S on Pin 8
const int PIN_SCANNING_SERVO = 9;
const int PIN_SORTING_SERVO = 8;
 
// Ultrasonic Sensor (for Obstacle Scanning with SG90)
const int TRIG_SCANNING = 32;
const int ECHO_SCANNING = 33;

// IR Sensors & Metal Sensor
const int IR_BIN_SENSOR = 34;    // Single IR sensor for bin level
const int IR_SORT_TRIGGER = 36;
const int METAL_SENSOR = 37;

// Status Indicator & Multi-tone Buzzer
const int LED_PIN = 40;
const int BUZZER_PIN = 43;

// Dynamic Scanning Sweep Variables
int scanAngle = 135;     
int scanDirection = 10;  

// Function Prototypes
long getDistance(int trigPin, int echoPin);
void setServoAngle(Servo &servo, int angle);
void moveForward(int speed);
void moveBackward(int speed);
void stopRobot();
void playTone(int type); // 1: Startup, 2: Obstacle, 3: Bin Full, 4: IR Detected

void setup() {
  Serial.begin(9600);
  Serial.println(F("--- Smart Lab Guardian Booting (Single Bin IR) ---"));

  // 1. Motor Pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);

  // 2. Relay Pin
  pinMode(SYSTEM_RELAY_PIN, OUTPUT);
  digitalWrite(SYSTEM_RELAY_PIN, HIGH); // Default OFF (Active LOW Relay)

  // 3. Sensor Pins
  pinMode(TRIG_SCANNING, OUTPUT);
  pinMode(ECHO_SCANNING, INPUT);
  pinMode(IR_BIN_SENSOR, INPUT);
  pinMode(IR_SORT_TRIGGER, INPUT);
  pinMode(METAL_SENSOR, INPUT);

  // 4. Indicators
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // 5. Servos
  scanningServo.attach(PIN_SCANNING_SERVO, 500, 2500);
  sortingServo.attach(PIN_SORTING_SERVO, 500, 2500);

  // Calibration
  setServoAngle(scanningServo, 135);
  setServoAngle(sortingServo, 135); // Neutral center position

  // Startup Sound & LED
  playTone(1); 
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  // -------------------------------------------------------------
  // PHASE 1: Single IR Bin Level Capacity Safeguard
  // -------------------------------------------------------------
  if (digitalRead(IR_BIN_SENSOR) == LOW) { // Triggered when bin reaches threshold
    Serial.println(F("CRITICAL: Storage Bin Full! Operation Halted."));
    digitalWrite(LED_PIN, HIGH);
    playTone(3); // Bin Full Tone
    stopRobot();
    return; 
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  // -------------------------------------------------------------
  // PHASE 2: SG90 Obstacle Scanning
  // -------------------------------------------------------------
  scanAngle += scanDirection;
  if (scanAngle <= 30 || scanAngle >= 240) {
    scanDirection = -scanDirection;
  }
  setServoAngle(scanningServo, scanAngle);

  long frontDistance = getDistance(TRIG_SCANNING, ECHO_SCANNING);
  if (frontDistance > 0 && frontDistance < 15) {
    Serial.println(F("Obstacle Detected! Evasion Routine."));
    stopRobot();
    playTone(2); // Obstacle Tone
    moveBackward(150);
    delay(500);
    stopRobot();
    return;
  } else {
    moveForward(180);
    digitalWrite(SYSTEM_RELAY_PIN, LOW); // Turn on Brush & Conveyor via Relay
  }

  // -------------------------------------------------------------
  // PHASE 3: IR Debris Detection & Sorting
  // -------------------------------------------------------------
  if (digitalRead(IR_SORT_TRIGGER) == LOW) { // Object detected under sorting IR
    Serial.println(F("Debris Detected in Sorting Zone!"));
    stopRobot();
    playTone(4); // IR Detection Tone

    if (digitalRead(METAL_SENSOR) == LOW) {
      Serial.println(F("Material: Metal -> Upward Component Bin"));
      setServoAngle(sortingServo, 180); // Anti-clockwise / Upward
    } else {
      Serial.println(F("Material: Waste -> Downward Trash Bin"));
      setServoAngle(sortingServo, 0);   // Clockwise / Downward
    }

    delay(5000); // 5-second time limit for servo operation
    setServoAngle(sortingServo, 135); // Return to neutral center
    delay(500);
  }

  delay(30);
}

// --- Helper Functions ---

long getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 25000);
  if (duration == 0) return 999;
  return (duration * 0.034 / 2);
}

void setServoAngle(Servo &servo, int angle) {
  angle = constrain(angle, 0, 270);
  int pulseWidth = map(angle, 0, 270, 500, 2500);
  servo.writeMicroseconds(pulseWidth);
}

void moveForward(int speed) {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
}

void moveBackward(int speed) {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENA, speed);
  analogWrite(ENB, speed);
}

void stopRobot() {
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(SYSTEM_RELAY_PIN, HIGH); // Turn off Relay
}

void playTone(int type) {
  if (type == 1) {
    // Startup: Two quick beeps
    tone(BUZZER_PIN, 1000, 100); delay(150);
    tone(BUZZER_PIN, 1500, 100); delay(100);
  } else if (type == 2) {
    // Obstacle: Rapid alternating beeps
    for(int i=0; i<3; i++) {
      tone(BUZZER_PIN, 800, 80); delay(100);
    }
  } else if (type == 3) {
    // Bin Full: Long continuous warning tone
    tone(BUZZER_PIN, 500, 600); delay(700);
  } else if (type == 4) {
    // IR Component Detected: Single medium beep
    tone(BUZZER_PIN, 1200, 200); delay(250);
  }
}

#include <SoftwareSerial.h>
#include <DHT.h>

// ============================================================
// PIN DEFINITIONS
// ============================================================

// ---------------- Ultrasonic ----------------
#define TRIG_PIN 6
#define ECHO_PIN 7

// ---------------- DHT11 ----------------
#define DHT_PIN 9
#define DHT_TYPE DHT11

// ---------------- MQ2 ----------------
#define MQ2_PIN A0

// ---------------- Microphone ----------------
#define MIC_PIN A1

// ---------------- PIR ----------------
#define PIR_PIN A2

// ---------------- Flame ----------------
#define FLAME_PIN A3

// ---------------- Elechouse V3.1 ----------------
// Module TX -> Arduino D2
// Module RX -> Arduino D3
#define VOICE_RX 2
#define VOICE_TX 3


// ============================================================
// OBJECTS
// ============================================================

DHT dht(DHT_PIN, DHT_TYPE);

SoftwareSerial voiceSerial(VOICE_RX, VOICE_TX);


// ============================================================
// SETTINGS
// ============================================================

// MQ2 threshold
const int GAS_WARNING_LEVEL = 400;
const int GAS_DANGER_LEVEL  = 700;

// Ultrasonic thresholds in cm
const int DIST_WARNING = 50;
const int DIST_DANGER  = 20;

// Microphone threshold
// IMPORTANT:
// Adjust this after checking your microphone readings.
const int SOUND_THRESHOLD = 650;

// Time between dashboard telemetry packets
const unsigned long TELEMETRY_INTERVAL = 2000;

// Prevent the same sound event from repeatedly triggering
const unsigned long SOUND_EVENT_COOLDOWN = 5000;


// ============================================================
// VARIABLES
// ============================================================

unsigned long lastTelemetry = 0;
unsigned long lastSoundEvent = 0;

int lastMicValue = 0;

bool previousPIR = false;
bool previousFlame = false;


// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(9600);

  voiceSerial.begin(9600);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(PIR_PIN, INPUT);

  pinMode(FLAME_PIN, INPUT);

  pinMode(MQ2_PIN, INPUT);

  pinMode(MIC_PIN, INPUT);

  dht.begin();

  Serial.println();
  Serial.println("========================================");
  Serial.println("FOREST PROTECTION SYSTEM");
  Serial.println("========================================");
  Serial.println("System starting...");
  Serial.println("Buzzer: REMOVED");
  Serial.println("SD Card: REMOVED");
  Serial.println("========================================");

  delay(2000);

  Serial.println("SYSTEM:READY");
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop() {

  // ----------------------------------------------------------
  // Read sensors
  // ----------------------------------------------------------

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  int gasValue = analogRead(MQ2_PIN);
  int micValue = analogRead(MIC_PIN);

  int pirValue = digitalRead(PIR_PIN);
  int flameValue = digitalRead(FLAME_PIN);

  float distance = readDistance();


  // ----------------------------------------------------------
  // Fix invalid DHT values
  // ----------------------------------------------------------

  if (isnan(temperature)) {
    temperature = 0;
  }

  if (isnan(humidity)) {
    humidity = 0;
  }


  // ----------------------------------------------------------
  // Process sensors
  // ----------------------------------------------------------

  processPIR(pirValue);

  processFlame(flameValue);

  processGas(gasValue);

  processDistance(distance);

  processSound(micValue);


  // ----------------------------------------------------------
  // Read voice module
  // ----------------------------------------------------------

  readVoiceModule();


  // ----------------------------------------------------------
  // Send telemetry to dashboard
  // ----------------------------------------------------------

  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL) {

    lastTelemetry = millis();

    sendTelemetry(
      temperature,
      humidity,
      gasValue,
      distance,
      pirValue,
      flameValue,
      micValue
    );
  }


  delay(50);
}


// ============================================================
// ULTRASONIC DISTANCE
// ============================================================

float readDistance() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration =
    pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return 999;
  }

  float distance =
    duration * 0.0343 / 2.0;

  return distance;
}


// ============================================================
// PIR PROCESSING
// ============================================================

void processPIR(int value) {

  bool motionDetected = (value == HIGH);

  if (motionDetected) {

    if (!previousPIR) {

      Serial.println(
        "EVENT:PIR_MOTION"
      );
    }

    previousPIR = true;
  }

  else {

    previousPIR = false;
  }
}


// ============================================================
// FLAME PROCESSING
// ============================================================
//
// Many flame modules use:
// LOW  = flame detected
// HIGH = no flame
//
// If your module works opposite, change:
// bool flameDetected = (value == LOW);
// to:
// bool flameDetected = (value == HIGH);
// ============================================================

void processFlame(int value) {

  bool flameDetected = (value == LOW);

  if (flameDetected) {

    if (!previousFlame) {

      Serial.println(
        "EVENT:FIRE"
      );
    }

    previousFlame = true;
  }

  else {

    previousFlame = false;
  }
}


// ============================================================
// MQ2 GAS / SMOKE PROCESSING
// ============================================================

void processGas(int value) {

  if (value >= GAS_DANGER_LEVEL) {

    Serial.print("EVENT:GAS_DANGER,VALUE:");
    Serial.println(value);
  }

  else if (value >= GAS_WARNING_LEVEL) {

    Serial.print("EVENT:GAS_WARNING,VALUE:");
    Serial.println(value);
  }
}


// ============================================================
// DISTANCE PROCESSING
// ============================================================

void processDistance(float distance) {

  if (distance <= DIST_DANGER) {

    Serial.print("EVENT:OBJECT_NEAR,DIST:");
    Serial.println(distance, 1);
  }

  else if (distance <= DIST_WARNING) {

    Serial.print("EVENT:OBJECT_WARNING,DIST:");
    Serial.println(distance, 1);
  }
}


// ============================================================
// MICROPHONE / SOUND PROCESSING
// ============================================================
//
// The analog microphone cannot reliably identify a specific
// real-world sound such as a bullet, chainsaw or falling tree
// from amplitude alone.
//
// This section detects an abnormal acoustic signal and reports
// it as SOUND_DETECTED.
//
// Specific event names can still be sent by the voice module
// or dashboard.
// ============================================================

void processSound(int micValue) {

  lastMicValue = micValue;

  if (micValue < SOUND_THRESHOLD) {
    return;
  }

  if (millis() - lastSoundEvent <
      SOUND_EVENT_COOLDOWN) {
    return;
  }

  lastSoundEvent = millis();

  Serial.print("AUDIO:SOUND_DETECTED,CONF:");
  Serial.print(75);
  Serial.print(",SIGNAL:Microphone acoustic signal,LEVEL:");
  Serial.println(micValue);
}


// ============================================================
// VOICE MODULE SERIAL READER
// ============================================================
//
// This allows the voice-recognition module or another serial
// device to send recognizable event names.
//
// Supported keywords:
//
// ANIMAL
// HUNTING
// BULLET
// GUNSHOT
// TREE
// CUTTING
// CHAINSAW
// FALLING
//
// Example:
//
// AUDIO:animal_hunting,CONF:95,SIGNAL:Animal hunting sound
// ============================================================

void readVoiceModule() {

  if (!voiceSerial.available()) {
    return;
  }

  String command = "";

  while (voiceSerial.available()) {

    char c = voiceSerial.read();

    if (c == '\n' || c == '\r') {
      break;
    }

    command += c;

    delay(2);
  }

  command.trim();

  if (command.length() == 0) {
    return;
  }

  command.toUpperCase();

  Serial.print("VOICE:");
  Serial.println(command);


  // ----------------------------------------------------------
  // Animal hunting
  // ----------------------------------------------------------

  if (
    command.indexOf("ANIMAL") >= 0 ||
    command.indexOf("HUNTING") >= 0
  ) {

    sendAudioEvent(
      "animal_hunting",
      95,
      "Animal hunting acoustic signature"
    );

    return;
  }


  // ----------------------------------------------------------
  // Bullet / gunshot
  // ----------------------------------------------------------

  if (
    command.indexOf("BULLET") >= 0 ||
    command.indexOf("GUNSHOT") >= 0 ||
    command.indexOf("SHOT") >= 0
  ) {

    sendAudioEvent(
      "gunshot_sound",
      95,
      "Detected high-impact acoustic signature"
    );

    return;
  }


  // ----------------------------------------------------------
  // Tree cutting machine
  // ----------------------------------------------------------

  if (
    command.indexOf("TREE CUT") >= 0 ||
    command.indexOf("CUTTING") >= 0 ||
    command.indexOf("CHAINSAW") >= 0 ||
    command.indexOf("MACHINE") >= 0
  ) {

    sendAudioEvent(
      "tree_cutting_machine",
      92,
      "Tree cutting machine acoustic signature"
    );

    return;
  }


  // ----------------------------------------------------------
  // Falling tree
  // ----------------------------------------------------------

  if (
    command.indexOf("FALLING") >= 0 ||
    command.indexOf("FALL TREE") >= 0 ||
    command.indexOf("TREE FALL") >= 0
  ) {

    sendAudioEvent(
      "falling_tree",
      90,
      "Falling tree acoustic signature"
    );

    return;
  }
}


// ============================================================
// SEND AUDIO EVENT
// ============================================================

void sendAudioEvent(
  String eventName,
  int confidence,
  String signal
) {

  Serial.print("AUDIO:");
  Serial.print(eventName);

  Serial.print(",CONF:");
  Serial.print(confidence);

  Serial.print(",SIGNAL:");
  Serial.println(signal);


  // Also send EVENT format for dashboard compatibility

  Serial.print("EVENT:");
  Serial.print(eventName);

  Serial.print(",CONF:");
  Serial.println(confidence);
}


// ============================================================
// SEND TELEMETRY
// ============================================================

void sendTelemetry(
  float temperature,
  float humidity,
  int gasValue,
  float distance,
  int pirValue,
  int flameValue,
  int micValue
) {

  Serial.print("TELEMETRY:");

  // LDR is not physically connected in the current wiring.
  // We send SAFE so the dashboard remains compatible.
  Serial.print("LDR:SAFE");

  // PIR
  Serial.print(",PIR:");

  if (pirValue == HIGH) {
    Serial.print("MOTION");
  }
  else {
    Serial.print("CLEAR");
  }

  // Flame
  Serial.print(",FLAME:");

  if (flameValue == LOW) {
    Serial.print("FIRE");
  }
  else {
    Serial.print("CLEAR");
  }

  // MQ2
  Serial.print(",GAS:");
  Serial.print(gasValue);

  // Distance
  Serial.print(",DIST:");
  Serial.print(distance, 1);

  // Temperature
  Serial.print(",TEMP:");
  Serial.print(temperature, 1);

  // Humidity
  Serial.print(",HUM:");
  Serial.print(humidity, 1);

  // Sound
  Serial.print(",SOUND:");
  Serial.print(micValue);

  Serial.println();
}


// ============================================================
// OPTIONAL SERIAL COMMANDS
// ============================================================
//
// You can type these commands into Serial Monitor:
//
// TEST_ANIMAL
// TEST_GUNSHOT
// TEST_TREE
// TEST_FALLING
//
// They will send events to the dashboard.
//
// ============================================================

void serialEvent() {

  String command = "";

  while (Serial.available()) {

    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      break;
    }

    command += c;
  }

  command.trim();
  command.toUpperCase();


  if (command == "TEST_ANIMAL") {

    sendAudioEvent(
      "animal_hunting",
      98,
      "TEST animal hunting event"
    );
  }


  else if (command == "TEST_GUNSHOT") {

    sendAudioEvent(
      "gunshot_sound",
      98,
      "TEST gunshot event"
    );
  }


  else if (command == "TEST_TREE") {

    sendAudioEvent(
      "tree_cutting_machine",
      98,
      "TEST tree cutting event"
    );
  }


  else if (command == "TEST_FALLING") {

    sendAudioEvent(
      "falling_tree",
      98,
      "TEST falling tree event"
    );
  }
}

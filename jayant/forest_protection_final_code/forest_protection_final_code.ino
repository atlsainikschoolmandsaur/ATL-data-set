```cpp
#include <SoftwareSerial.h>
#include <DHT.h>

// =================================================
// PIN DEFINITIONS
// =================================================

// Ultrasonic
#define TRIG_PIN 6
#define ECHO_PIN 7

// DHT11
#define DHT_PIN 9
#define DHT_TYPE DHT11

// PIR
#define PIR_PIN A2

// Flame
#define FLAME_PIN A3

// MQ2 Gas Sensor
#define MQ2_PIN A0

// Microphone
#define MIC_ANALOG_PIN A1

// Buzzer
#define BUZZER_PIN A5

// =================================================
// DHT11
// =================================================

DHT dht(DHT_PIN, DHT_TYPE);

// =================================================
// ELECHOUSE V3.1
// Module TX -> Arduino D2
// Module RX -> Arduino D3
// =================================================

SoftwareSerial voice(2, 3);

// =================================================
// TIMER
// =================================================

unsigned long startTime = 0;
unsigned long lastBuzzerTime = 0;

// Microphone threshold
#define MIC_THRESHOLD 600

// =================================================
// SETUP
// =================================================

void setup() {

  Serial.begin(9600);
  voice.begin(9600);

  startTime = millis();

  // Ultrasonic
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // PIR
  pinMode(PIR_PIN, INPUT);

  // Flame
  pinMode(FLAME_PIN, INPUT);

  // Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  // DHT11
  dht.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("A.E.G.I.S. FOREST PROTECTION");
  Serial.println("================================");

  Serial.println("DHT11 READY");
  Serial.println("PIR READY");
  Serial.println("FLAME SENSOR READY");
  Serial.println("MQ2 READY");
  Serial.println("ULTRASONIC READY");
  Serial.println("MICROPHONE READY");
  Serial.println("ELECHOUSE VOICE V3.1 READY");
  Serial.println("SD CARD REMOVED");

  Serial.println();
  Serial.println("BUZZER RULES:");
  Serial.println("PIR MOTION -> NO BUZZER");
  Serial.println("MIC SOUND -> BUZZER");
  Serial.println("DISTANCE < 15cm -> CONTINUOUS BUZZER");
  Serial.println("DISTANCE 15-30cm -> FAST BEEP");
  Serial.println("DISTANCE 30-50cm -> SLOW BEEP");
  Serial.println();

  Serial.println("Waiting for commands...");
  Serial.println();
}

// =================================================
// MAIN LOOP
// =================================================

void loop() {

  // -------------------------------------------------
  // COMPUTER COMMANDS
  // -------------------------------------------------

  if (Serial.available()) {

    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    handleIncomingCommand(cmd);
  }

  // -------------------------------------------------
  // VOICE MODULE
  // -------------------------------------------------

  checkVoiceRecognition();

  // -------------------------------------------------
  // SENSOR TELEMETRY
  // -------------------------------------------------

  static unsigned long lastStreamTime = 0;

  if (millis() - lastStreamTime >= 1000) {

    lastStreamTime = millis();

    sendTelemetry();
  }
}

// =================================================
// VOICE RECOGNITION
// =================================================

void checkVoiceRecognition() {

  if (voice.available()) {

    int data = voice.read();

    unsigned long seconds =
      (millis() - startTime) / 1000;

    int hours = seconds / 3600;

    int minutes =
      (seconds % 3600) / 60;

    int secs =
      seconds % 60;

    Serial.print("VOICE RECEIVED AT ");

    if (hours < 10)
      Serial.print("0");

    Serial.print(hours);

    Serial.print(":");

    if (minutes < 10)
      Serial.print("0");

    Serial.print(minutes);

    Serial.print(":");

    if (secs < 10)
      Serial.print("0");

    Serial.print(secs);

    Serial.print(" -> DATA: ");

    Serial.println(data);

    // Voice module detected something
    // This DOES cause a buzzer beep.
    Serial.println("BUZZER: VOICE EVENT");

    tone(BUZZER_PIN, 1000, 100);
  }
}

// =================================================
// SENSOR TELEMETRY
// =================================================

void sendTelemetry() {

  // =================================================
  // PIR
  // =================================================

  bool pirMotion =
    (digitalRead(PIR_PIN) == HIGH);

  // =================================================
  // FLAME
  // =================================================

  bool flameDetected =
    (digitalRead(FLAME_PIN) == LOW);

  // =================================================
  // MQ2 GAS
  // =================================================

  int gasVal =
    analogRead(MQ2_PIN);

  // =================================================
  // MICROPHONE
  // =================================================

  int micVal =
    analogRead(MIC_ANALOG_PIN);

  // =================================================
  // ULTRASONIC
  // =================================================

  digitalWrite(TRIG_PIN, LOW);

  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);

  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration =
    pulseIn(ECHO_PIN, HIGH, 20000);

  int distanceCm;

  if (duration == 0) {

    distanceCm = 999;

  } else {

    distanceCm =
      duration * 0.034 / 2;
  }

  // =================================================
  // BUZZER SYSTEM
  //
  // IMPORTANT:
  // PIR DOES NOT CONTROL BUZZER
  // =================================================

  unsigned long currentTime = millis();

  // -------------------------------------------------
  // PRIORITY 1: MICROPHONE
  // -------------------------------------------------

  if (micVal > MIC_THRESHOLD) {

    Serial.println("BUZZER: MICROPHONE SOUND");

    tone(BUZZER_PIN, 1300, 250);

    lastBuzzerTime = currentTime;
  }

  // -------------------------------------------------
  // PRIORITY 2: ULTRASONIC
  // -------------------------------------------------

  else {

    // -----------------------------------------------
    // Object < 15 cm
    // -----------------------------------------------

    if (distanceCm < 15) {

      Serial.println("BUZZER: OBJECT < 15 CM");

      tone(BUZZER_PIN, 1500);
    }

    // -----------------------------------------------
    // Object 15-30 cm
    // -----------------------------------------------

    else if (distanceCm < 30) {

      if (currentTime - lastBuzzerTime >= 500) {

        Serial.println("BUZZER: OBJECT 15-30 CM");

        tone(BUZZER_PIN, 1200, 150);

        lastBuzzerTime = currentTime;
      }
    }

    // -----------------------------------------------
    // Object 30-50 cm
    // -----------------------------------------------

    else if (distanceCm < 50) {

      if (currentTime - lastBuzzerTime >= 1000) {

        Serial.println("BUZZER: OBJECT 30-50 CM");

        tone(BUZZER_PIN, 1000, 100);

        lastBuzzerTime = currentTime;
      }
    }

    // -----------------------------------------------
    // Object > 50 cm
    // -----------------------------------------------

    else {

      noTone(BUZZER_PIN);
    }
  }

  // =================================================
  // DHT11
  // =================================================

  float temperature =
    dht.readTemperature();

  float humidity =
    dht.readHumidity();

  if (isnan(temperature) ||
      isnan(humidity)) {

    Serial.println("DHT ERROR");

    temperature = -1;
    humidity = -1;
  }

  // =================================================
  // MACHINE-READABLE TELEMETRY
  // =================================================

  Serial.print("TELEMETRY:");

  Serial.print(",PIR:");

  Serial.print(
    pirMotion ? "MOTION" : "CLEAR"
  );

  Serial.print(",FLAME:");

  Serial.print(
    flameDetected ? "FIRE" : "CLEAR"
  );

  Serial.print(",GAS:");

  Serial.print(gasVal);

  Serial.print(",MIC:");

  Serial.print(micVal);

  Serial.print(",DIST:");

  Serial.print(distanceCm);

  Serial.print(",TEMP:");

  Serial.print(temperature, 1);

  Serial.print(",HUM:");

  Serial.print(humidity, 1);

  Serial.println();
}

// =================================================
// COMPUTER COMMANDS
// =================================================

void handleIncomingCommand(String cmd) {

  // -------------------------------------------------
  // BUZZER TEST
  // -------------------------------------------------

  if (cmd == "TEST_BUZZER") {

    tone(BUZZER_PIN, 1000, 500);

    Serial.println("BUZZER TEST");
  }

  // -------------------------------------------------
  // READ SENSORS
  // -------------------------------------------------

  else if (cmd == "READ_SENSORS") {

    sendTelemetry();
  }

  // -------------------------------------------------
  // VOICE TEST
  // -------------------------------------------------

  else if (cmd == "VOICE_TEST") {

    Serial.println("VOICE MODULE TEST");

    tone(BUZZER_PIN, 1500, 200);
  }

  // -------------------------------------------------
  // MIC TEST
  // -------------------------------------------------

  else if (cmd == "MIC_TEST") {

    int micValue =
      analogRead(MIC_ANALOG_PIN);

    Serial.print("MIC:");

    Serial.println(micValue);
  }

  // -------------------------------------------------
  // UNKNOWN COMMAND
  // -------------------------------------------------

  else {

    Serial.print("UNKNOWN COMMAND: ");

    Serial.println(cmd);
  }
}
```
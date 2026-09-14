/*
   ================================================
   ENVIRONMENTAL SOUND MONITORING SYSTEM
   Arduino UNO
   ================================================

   Sound events supported by the dashboard:

   1. ANIMAL_HUNTING
   2. GUNSHOT_SOUND
   3. TREE_CUTTING_MACHINE
   4. FALLING_TREE

   Hardware:
   - Arduino UNO
   - Analog Sound Sensor / Microphone
   - LED
   - Buzzer

   Connections:
   Sound Sensor AO -> A0
   Sound Sensor VCC -> 5V
   Sound Sensor GND -> GND

   LED:
   LED + -> D13
   LED - -> GND

   Buzzer:
   Buzzer + -> D8
   Buzzer - -> GND
*/

// =================================================
// PIN DEFINITIONS
// =================================================

const int SOUND_SENSOR_PIN = A0;
const int LED_PIN = 13;
const int BUZZER_PIN = 8;


// =================================================
// SETTINGS
// =================================================

// Change this value according to your sound sensor
const int SOUND_THRESHOLD = 600;

// Very loud sound threshold
const int VERY_LOUD_THRESHOLD = 850;

// Time between two events
const unsigned long EVENT_COOLDOWN = 3000;


// =================================================
// VARIABLES
// =================================================

unsigned long lastEventTime = 0;

int soundValue = 0;


// =================================================
// SETUP
// =================================================

void setup() {

  // Start Serial communication
  Serial.begin(9600);

  // Pin modes
  pinMode(SOUND_SENSOR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Initial state
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  delay(1000);

  // Tell JavaScript that Arduino is ready
  Serial.println("SYSTEM_READY");

  delay(500);

  Serial.println("SOUND_MONITOR_STARTED");
}


// =================================================
// MAIN LOOP
// =================================================

void loop() {

  // Read sound sensor
  soundValue = analogRead(SOUND_SENSOR_PIN);


  // ------------------------------------------------
  // SEND SOUND LEVEL TO JAVASCRIPT
  // ------------------------------------------------

  Serial.print("SOUND_LEVEL:");
  Serial.println(soundValue);


  // ------------------------------------------------
  // CHECK FOR SOUND
  // ------------------------------------------------

  if (soundValue >= SOUND_THRESHOLD) {

    // Check cooldown
    if (millis() - lastEventTime >= EVENT_COOLDOWN) {

      detectSound(soundValue);

      lastEventTime = millis();
    }
  }


  delay(100);
}


// =================================================
// SOUND DETECTION
// =================================================

void detectSound(int value) {

  /*
     IMPORTANT:

     The following thresholds are ONLY for testing.

     A normal analog sound sensor does NOT know
     what type of sound it is hearing.

     For actual classification, replace this function
     with the result from your audio/ML classifier.
  */


  if (value >= VERY_LOUD_THRESHOLD) {

    // Very loud sound
    sendEvent(
      "GUNSHOT_SOUND",
      0.90
    );

  }

  else if (value >= 750) {

    // High sound
    sendEvent(
      "TREE_CUTTING_MACHINE",
      0.85
    );

  }

  else if (value >= 650) {

    // Medium-high sound
    sendEvent(
      "FALLING_TREE",
      0.80
    );

  }

  else {

    // Lower detected sound
    sendEvent(
      "ANIMAL_HUNTING",
      0.75
    );
  }
}


// =================================================
// SEND EVENT
// =================================================

void sendEvent(String eventName, float confidence) {

  // Turn ON LED
  digitalWrite(LED_PIN, HIGH);


  // ------------------------------------------------
  // SEND EVENT TO JAVASCRIPT
  //
  // Format:
  //
  // EVENT:EVENT_NAME:CONFIDENCE
  // ------------------------------------------------

  Serial.print("EVENT:");
  Serial.print(eventName);
  Serial.print(":");
  Serial.println(confidence, 2);


  // ------------------------------------------------
  // SEND EVENT MESSAGE
  // ------------------------------------------------

  Serial.print("DETECTED:");
  Serial.println(eventName);


  // ------------------------------------------------
  // BUZZER ALERT
  // ------------------------------------------------

  digitalWrite(BUZZER_PIN, HIGH);

  delay(250);

  digitalWrite(BUZZER_PIN, LOW);


  // Keep LED on briefly
  delay(250);

  digitalWrite(LED_PIN, LOW);
}


// =================================================
// OPTIONAL TEST COMMANDS
// =================================================

/*
   You can type commands into the Serial Monitor
   to test the dashboard without making sounds.

   Commands:

   animal
   gunshot
   cutting
   falling
   test
*/

void checkSerialCommand() {

  if (Serial.available()) {

    String command = Serial.readStringUntil('\n');

    command.trim();


    if (command == "animal") {

      sendEvent(
        "ANIMAL_HUNTING",
        0.95
      );
    }


    else if (command == "gunshot") {

      sendEvent(
        "GUNSHOT_SOUND",
        0.95
      );
    }


    else if (command == "cutting") {

      sendEvent(
        "TREE_CUTTING_MACHINE",
        0.95
      );
    }


    else if (command == "falling") {

      sendEvent(
        "FALLING_TREE",
        0.95
      );
    }


    else if (command == "test") {

      Serial.println("TEST_OK");
    }
  }
}
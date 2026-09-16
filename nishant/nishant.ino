#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// =====================================================
// LCD
// =====================================================

LiquidCrystal_I2C lcd(0x27, 16, 2);

// =====================================================
// PIN DEFINITIONS - ARDUINO MEGA 2560
// =====================================================

const int trigPin = 9;
const int echoPin = 8;

const int irSensorPin = 7;

const int greenLedPin = 10;
const int redLedPin = 11;

const int buzzerPin = 12;

const int laserPin = 5;

const int scannerServoPin = 3;
const int disposalServoPin = 48;

// =====================================================
// SERVO OBJECTS
// =====================================================

Servo scannerServo;
Servo disposalServo;

// =====================================================
// SETTINGS
// =====================================================

const int detectionDistance = 20;  // Detection distance in cm
const int disposalAngle = 90;

// Scanner settings
const int scanStep = 5;
const int scanDelay = 50;

// =====================================================
// FUNCTION DECLARATIONS
// =====================================================

long getUltrasonicDistance();

void updateLCD(int angle, long distance);

void debrisDetected(int angle, long distance);

void normalScanning(int angle, long distance);

// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(9600);

  // ---------------------------------------------------
  // LCD INITIALIZATION
  // ---------------------------------------------------

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SPACE DEFENCE");

  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  delay(2000);

  lcd.clear();

  // ---------------------------------------------------
  // PIN MODES
  // ---------------------------------------------------

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  pinMode(irSensorPin, INPUT);

  pinMode(greenLedPin, OUTPUT);
  pinMode(redLedPin, OUTPUT);

  pinMode(buzzerPin, OUTPUT);
  pinMode(laserPin, OUTPUT);

  // ---------------------------------------------------
  // SERVO ATTACH
  // ---------------------------------------------------

  scannerServo.attach(scannerServoPin);
  disposalServo.attach(disposalServoPin);

  // ---------------------------------------------------
  // INITIAL SERVO POSITIONS
  // ---------------------------------------------------

  scannerServo.write(0);
  disposalServo.write(0);

  // ---------------------------------------------------
  // INITIAL OUTPUT STATES
  // ---------------------------------------------------

  digitalWrite(greenLedPin, HIGH);
  digitalWrite(redLedPin, LOW);

  digitalWrite(buzzerPin, LOW);
  digitalWrite(laserPin, LOW);

  // ---------------------------------------------------
  // READY SCREEN
  // ---------------------------------------------------

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");

  lcd.setCursor(0, 1);
  lcd.print("Scanning...");

  delay(1000);

  lcd.clear();

  Serial.println("==============================");
  Serial.println("SPACE DEFENCE SYSTEM READY");
  Serial.println("==============================");
}

// =====================================================
// MAIN LOOP
// =====================================================

void loop()
{
  // ===================================================
  // SWEEP 0 -> 180 DEGREES
  // ===================================================

  for (int angle = 0; angle <= 180; angle += scanStep)
  {
    scannerServo.write(angle);

    delay(scanDelay);

    long distance = getUltrasonicDistance();

    updateLCD(angle, distance);

    Serial.print("Angle: ");
    Serial.print(angle);

    Serial.print(" | Distance: ");
    Serial.print(distance);

    Serial.println(" cm");

    // -------------------------------------------------
    // DEBRIS DETECTION
    // -------------------------------------------------

    if (distance > 0 && distance <= detectionDistance)
    {
      debrisDetected(angle, distance);
    }
  }

  // ===================================================
  // SWEEP 180 -> 0 DEGREES
  // ===================================================

  for (int angle = 180; angle >= 0; angle -= scanStep)
  {
    scannerServo.write(angle);

    delay(scanDelay);

    long distance = getUltrasonicDistance();

    updateLCD(angle, distance);

    Serial.print("Angle: ");
    Serial.print(angle);

    Serial.print(" | Distance: ");
    Serial.print(distance);

    Serial.println(" cm");

    // -------------------------------------------------
    // DEBRIS DETECTION
    // -------------------------------------------------

    if (distance > 0 && distance <= detectionDistance)
    {
      debrisDetected(angle, distance);
    }
  }

  // Then loop() starts again automatically.
  // Therefore scanner continuously sweeps:
  //
  // 0 -> 180 -> 0 -> 180 -> 0 -> ...
}

// =====================================================
// ULTRASONIC DISTANCE FUNCTION
// =====================================================

long getUltrasonicDistance()
{
  // Make sure trigger is LOW
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // Send 10 microsecond trigger pulse
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read echo
  long duration = pulseIn(echoPin, HIGH, 30000);

  // No echo received
  if (duration == 0)
  {
    return 400;
  }

  // Calculate distance
  long distance = duration * 0.034 / 2;

  return distance;
}

// =====================================================
// DEBRIS DETECTION AND DISPOSAL
// =====================================================

void debrisDetected(int angle, long distance)
{
  // ===================================================
  // STOP SCANNER AT DETECTED ANGLE
  // ===================================================

  scannerServo.write(angle);

  Serial.println();
  Serial.println("==============================");
  Serial.println("!!! DEBRIS DETECTED !!!");
  Serial.println("==============================");

  Serial.print("Detection Angle: ");
  Serial.println(angle);

  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  // ===================================================
  // RED LED ON
  // ===================================================

  digitalWrite(greenLedPin, LOW);
  digitalWrite(redLedPin, HIGH);

  // ===================================================
  // BUZZER WARNING
  // ===================================================

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("DEBRIS FOUND!");

  lcd.setCursor(0, 1);
  lcd.print("D:");
  lcd.print(distance);
  lcd.print("cm A:");
  lcd.print(angle);

  digitalWrite(buzzerPin, HIGH);

  delay(500);

  digitalWrite(buzzerPin, LOW);

  // ===================================================
  // TARGET LOCK
  // ===================================================

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("TARGET LOCKED");

  lcd.setCursor(0, 1);
  lcd.print("Angle:");
  lcd.print(angle);

  Serial.println("Target locked.");

  delay(500);

  // ===================================================
  // LASER ON
  // ===================================================

  digitalWrite(laserPin, HIGH);

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("LASER ACTIVE");

  lcd.setCursor(0, 1);
  lcd.print("Processing...");

  Serial.println("Laser activated.");
  Serial.println("Waiting 5 seconds...");

  // ===================================================
  // WAIT 5 SECONDS
  // ===================================================

  unsigned long startTime = millis();

  while (millis() - startTime < 5000)
  {
    // Keep scanner at detected angle
    scannerServo.write(angle);

    // Show countdown
    int remaining =
      5 - ((millis() - startTime) / 1000);

    if (remaining < 0)
    {
      remaining = 0;
    }

    lcd.setCursor(0, 1);
    lcd.print("Wait: ");
    lcd.print(remaining);
    lcd.print(" sec   ");

    delay(50);
  }

  // ===================================================
  // LASER OFF
  // ===================================================

  digitalWrite(laserPin, LOW);

  Serial.println("5 seconds completed.");
  Serial.println("Laser OFF.");

  // ===================================================
  // DEBRIS DESTROYED
  // ===================================================

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("DEBRIS CLEARED");

  lcd.setCursor(0, 1);
  lcd.print("Disposing...");

  Serial.println("Debris processing completed.");

  delay(500);

  // ===================================================
  // DISPOSAL SERVO MOVES AFTER 5 SECONDS
  // ===================================================

  Serial.println("Disposal servo -> 90 degrees");

  disposalServo.write(disposalAngle);

  // Keep disposal servo at 90 degrees
  delay(2000);

  // ===================================================
  // RETURN DISPOSAL SERVO
  // ===================================================

  disposalServo.write(0);

  Serial.println("Disposal servo -> 0 degrees");

  delay(1000);

  // ===================================================
  // RESET LED STATUS
  // ===================================================

  digitalWrite(redLedPin, LOW);
  digitalWrite(greenLedPin, HIGH);

  // ===================================================
  // SYSTEM READY AGAIN
  // ===================================================

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");

  lcd.setCursor(0, 1);
  lcd.print("Scanning...");

  Serial.println("==============================");
  Serial.println("RESUMING SCANNING");
  Serial.println("==============================");

  delay(500);

  lcd.clear();
}

// =====================================================
// LCD UPDATE FUNCTION
// =====================================================

void updateLCD(int angle, long distance)
{
  lcd.setCursor(0, 0);

  lcd.print("A:");
  lcd.print(angle);
  lcd.print((char)223);
  lcd.print("    ");

  lcd.setCursor(9, 0);

  lcd.print("D:");
  lcd.print(distance);
  lcd.print("cm");

  lcd.setCursor(0, 1);

  if (distance > 0 && distance <= detectionDistance)
  {
    lcd.print("DEBRIS DETECTED");
  }
  else
  {
    lcd.print("STATUS: SCANNING");
  }
}

// =====================================================
// NORMAL SCANNING FUNCTION
// =====================================================

void normalScanning(int angle, long distance)
{
  scannerServo.write(angle);

  updateLCD(angle, distance);
}

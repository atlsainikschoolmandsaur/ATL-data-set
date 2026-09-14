const int metalSensor = 2;

void setup() {
  Serial.begin(9600);
  pinMode(metalSensor, INPUT);

  Serial.println("KY-036 Metal Touch Sensor Test");
  Serial.println("Touch the metal plate...");
}

void loop() {
  int sensorState = digitalRead(metalSensor);

  if (sensorState == LOW) {
    Serial.println("METAL/TOUCH DETECTED");
  } else {
    Serial.println("NO METAL/TOUCH");
  }

  delay(300);
}
"use strict";

/* =========================================================
   A.E.G.I.S. TELEMETRY DASHBOARD
   CORRECTED JAVASCRIPT
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let serialPort = null;
let serialReader = null;
let serialConnected = false;

let simulationRunning = false;
let simulationTimer = null;

let gpsMap = null;
let gpsMarker = null;

let chart = null;

let radarAngle = 0;
let soundPhase = 0;

let alertMuted = false;

let temperatureHistory = [];
let humidityHistory = [];
let timeHistory = [];

let lastAudioEvent = null;


/* =========================================================
   EVENT CONFIGURATION
========================================================= */

const AUDIO_EVENTS = {

    animal_hunting: {
        title: "ANIMAL / HUNTING",
        statusId: "animalEventStatus",
        confidenceId: "animalEventConfidence",
        cardId: "animalEventCard"
    },

    gunshot_sound: {
        title: "GUNSHOT SOUND",
        statusId: "gunshotEventStatus",
        confidenceId: "gunshotEventConfidence",
        cardId: "gunshotEventCard"
    },

    tree_cutting_machine: {
        title: "TREE CUTTING MACHINE",
        statusId: "treeCuttingEventStatus",
        confidenceId: "treeCuttingEventConfidence",
        cardId: "treeCuttingEventCard"
    },

    falling_tree: {
        title: "FALLING TREE",
        statusId: "fallingTreeEventStatus",
        confidenceId: "fallingTreeEventConfidence",
        cardId: "fallingTreeEventCard"
    }

};


/* =========================================================
   PAGE START
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("A.E.G.I.S. JavaScript loaded");

    initializeGPSMap();

    initializeTemperatureChart();

    startRadarAnimation();

    startSoundAnimation();

    updateConnectionStatus(false);

    addToSerialLog(
        "SYSTEM: A.E.G.I.S. dashboard initialized"
    );

    addToSerialLog(
        "SYSTEM: Waiting for telemetry..."
    );

});


/* =========================================================
   SERIAL CONNECTION
========================================================= */

async function toggleSerialConnection() {

    if (serialConnected) {

        await disconnectSerial();

    } else {

        await connectSerial();

    }

}


async function connectSerial() {

    if (!("serial" in navigator)) {

        alert(
            "Web Serial is not supported in this browser.\n\n" +
            "Use Google Chrome or Microsoft Edge."
        );

        return;
    }


    try {

        serialPort =
            await navigator.serial.requestPort();


        await serialPort.open({
            baudRate: 9600
        });


        serialConnected = true;


        updateConnectionStatus(true);


        addToSerialLog(
            "SYSTEM: USB Serial connected"
        );


        readSerialLoop();

    }

    catch (error) {

        console.error(error);

        addToSerialLog(
            "ERROR: " + error.message
        );

        updateConnectionStatus(false);

    }

}


/* =========================================================
   SERIAL DISCONNECT
========================================================= */

async function disconnectSerial() {

    try {

        if (serialReader) {

            await serialReader.cancel();

            serialReader.releaseLock();

            serialReader = null;

        }


        if (serialPort) {

            await serialPort.close();

            serialPort = null;

        }

    }

    catch (error) {

        console.error(error);

    }

    finally {

        serialConnected = false;

        updateConnectionStatus(false);

        addToSerialLog(
            "SYSTEM: USB Serial disconnected"
        );

    }

}


/* =========================================================
   SERIAL READER
========================================================= */

async function readSerialLoop() {

    if (!serialPort || !serialPort.readable) {
        return;
    }


    const decoder = new TextDecoder();

    serialReader =
        serialPort.readable.getReader();


    let buffer = "";


    try {

        while (serialConnected) {

            const {
                value,
                done
            } = await serialReader.read();


            if (done) {
                break;
            }


            if (!value) {
                continue;
            }


            buffer += decoder.decode(
                value,
                {
                    stream: true
                }
            );


            const lines =
                buffer.split(/\r?\n/);


            buffer =
                lines.pop() || "";


            for (const line of lines) {

                const message =
                    line.trim();


                if (message.length > 0) {

                    processSerialMessage(
                        message
                    );

                }

            }

        }

    }

    catch (error) {

        console.error(error);

        addToSerialLog(
            "ERROR: Serial read failed - " +
            error.message
        );

    }

    finally {

        if (serialReader) {

            try {
                serialReader.releaseLock();
            }

            catch (e) {}

            serialReader = null;

        }

    }

}


/* =========================================================
   PROCESS SERIAL MESSAGE
========================================================= */

function processSerialMessage(message) {

    addToSerialLog(message);


    /* TELEMETRY */

    if (message.startsWith("TELEMETRY:")) {

        parseTelemetry(message);

        return;
    }


    /* OLD ANIMAL FORMAT */

    if (message.startsWith("ANIMAL:")) {

        parseAnimalData(message);

        return;
    }


    /* NEW AUDIO EVENT FORMAT */

    if (message.startsWith("AUDIO:")) {

        parseAudioEvent(message);

        return;
    }


    /* EVENT FORMAT */

    if (message.startsWith("EVENT:")) {

        parseAudioEvent(message);

        return;
    }


    /* JSON FORMAT */

    if (
        message.startsWith("{") &&
        message.endsWith("}")
    ) {

        try {

            const data =
                JSON.parse(message);


            if (data.event) {

                showAudioEvent(
                    data.event,
                    data.confidence ?? 0,
                    data.signal ?? "Audio event"
                );

            }

        }

        catch (error) {

            console.warn(
                "Invalid JSON packet"
            );

        }

        return;
    }


    /* GPS */

    if (message.startsWith("GPS:")) {

        parseGPSData(message);

        return;
    }

}


/* =========================================================
   TELEMETRY
========================================================= */

function parseTelemetry(message) {

    const content =
        message.substring(
            "TELEMETRY:".length
        );


    const data = {};


    content
        .split(",")
        .forEach(function (part) {

            const index =
                part.indexOf(":");


            if (index === -1) {
                return;
            }


            const key =
                part.substring(
                    0,
                    index
                ).trim();


            const value =
                part.substring(
                    index + 1
                ).trim();


            data[key] = value;

        });


    if (data.LDR !== undefined) {
        updateLDR(data.LDR);
    }


    if (data.PIR !== undefined) {
        updatePIR(data.PIR);
    }


    if (data.FLAME !== undefined) {
        updateFlame(data.FLAME);
    }


    if (data.GAS !== undefined) {
        updateGas(data.GAS);
    }


    if (data.DIST !== undefined) {
        updateDistance(data.DIST);
    }


    if (data.TEMP !== undefined) {
        updateTemperature(data.TEMP);
    }


    if (data.HUM !== undefined) {
        updateHumidity(data.HUM);
    }


    if (
        data.LAT !== undefined &&
        data.LNG !== undefined
    ) {

        updateMapMarker(
            parseFloat(data.LAT),
            parseFloat(data.LNG)
        );

    }


    if (data.SOUND !== undefined) {

        updateSoundStatus(
            data.SOUND
        );

    }

}


/* =========================================================
   LDR
========================================================= */

function updateLDR(value) {

    const badge =
        document.getElementById(
            "laserBadge"
        );

    const text =
        document.getElementById(
            "laserStatusText"
        );


    if (!badge || !text) {
        return;
    }


    const v =
        String(value).toUpperCase();


    if (
        v === "OK" ||
        v === "CLEAR" ||
        v === "SAFE"
    ) {

        badge.textContent = "SAFE";

        text.textContent =
            "CLEAR";

    }

    else {

        badge.textContent =
            "ALERT";

        text.textContent =
            "TRIGGERED";

        addAlert(
            "LASER ALERT",
            "Laser tripwire interrupted"
        );

    }

}


/* =========================================================
   PIR
========================================================= */

function updatePIR(value) {

    const badge =
        document.getElementById(
            "pirBadge"
        );

    const text =
        document.getElementById(
            "pirStatusText"
        );


    if (!badge || !text) {
        return;
    }


    const v =
        String(value).toUpperCase();


    if (
        v === "CLEAR" ||
        v === "NO_MOTION" ||
        v === "SAFE"
    ) {

        badge.textContent =
            "SAFE";

        text.textContent =
            "NO MOTION";

    }

    else {

        badge.textContent =
            "ALERT";

        text.textContent =
            "MOTION";

        addAlert(
            "PIR ALERT",
            "Movement detected"
        );

    }

}


/* =========================================================
   FLAME
========================================================= */

function updateFlame(value) {

    const badge =
        document.getElementById(
            "flameBadge"
        );

    const text =
        document.getElementById(
            "flameStatusText"
        );


    if (!badge || !text) {
        return;
    }


    const v =
        String(value).toUpperCase();


    if (
        v === "CLEAR" ||
        v === "SAFE" ||
        v === "NO_FLAME"
    ) {

        badge.textContent =
            "SAFE";

        text.textContent =
            "NO FLAME";

    }

    else {

        badge.textContent =
            "ALERT";

        text.textContent =
            "FIRE";

        addAlert(
            "FIRE ALERT",
            "Possible flame detected"
        );

        triggerEmergency(
            "FIRE DETECTED",
            "Immediate attention required"
        );

    }

}


/* =========================================================
   GAS
========================================================= */

function updateGas(value) {

    const numeric =
        parseFloat(value);


    const display =
        document.getElementById(
            "mq2ValDisplay"
        );

    const badge =
        document.getElementById(
            "mq2Badge"
        );


    if (!display || !badge) {
        return;
    }


    if (Number.isNaN(numeric)) {
        return;
    }


    display.textContent =
        Math.round(numeric) +
        " ADC";


    if (numeric > 700) {

        badge.textContent =
            "DANGER";

        addAlert(
            "GAS ALERT",
            "High gas/smoke level"
        );

    }

    else if (numeric > 400) {

        badge.textContent =
            "WARNING";

    }

    else {

        badge.textContent =
            "SAFE";

    }

}


/* =========================================================
   DISTANCE
========================================================= */

function updateDistance(value) {

    const distance =
        parseFloat(value);


    const display =
        document.getElementById(
            "distVal"
        );

    const zone =
        document.getElementById(
            "distZone"
        );


    if (
        !display ||
        !zone ||
        Number.isNaN(distance)
    ) {
        return;
    }


    display.textContent =
        Math.round(distance);


    if (distance < 20) {

        zone.textContent =
            "OBJECT VERY NEAR";

    }

    else if (distance < 50) {

        zone.textContent =
            "WARNING";

    }

    else {

        zone.textContent =
            "CLEAR";

    }

}


/* =========================================================
   TEMPERATURE
========================================================= */

function updateTemperature(value) {

    const temperature =
        parseFloat(value);


    const display =
        document.getElementById(
            "tempValDisplay"
        );


    if (
        !display ||
        Number.isNaN(temperature)
    ) {
        return;
    }


    display.textContent =
        temperature.toFixed(1) +
        " °C";


    const badge =
        document.getElementById(
            "tempBadge"
        );


    if (badge) {

        badge.textContent =
            "LIVE DATA";

    }


    addTemperatureData(
        temperature,
        null
    );

}


/* =========================================================
   HUMIDITY
========================================================= */

function updateHumidity(value) {

    const humidity =
        parseFloat(value);


    const display =
        document.getElementById(
            "humidityValDisplay"
        );


    if (
        !display ||
        Number.isNaN(humidity)
    ) {
        return;
    }


    display.textContent =
        humidity.toFixed(1) +
        " %";


    const badge =
        document.getElementById(
            "humidityBadge"
        );


    if (badge) {

        badge.textContent =
            "LIVE DATA";

    }


    addHumidityData(
        humidity
    );

}


/* =========================================================
   SOUND LEVEL
========================================================= */

function updateSoundStatus(value) {

    const badge =
        document.getElementById(
            "soundBadge"
        );

    const status =
        document.getElementById(
            "soundDistressStatus"
        );


    if (!badge || !status) {
        return;
    }


    badge.textContent =
        String(value);


    status.textContent =
        "Sound level: " +
        String(value);

}


/* =========================================================
   AUDIO EVENT PARSER
=========================================================

Supported examples:

AUDIO:animal_hunting,CONF:94,SIG:Animal
AUDIO:gunshot_sound,CONF:91,SIG:Acoustic event
AUDIO:tree_cutting_machine,CONF:97,SIG:Machine
AUDIO:falling_tree,CONF:89,SIG:Impact

Also:

EVENT:gunshot_sound,CONF:92,SIG:Detected

========================================================= */

function parseAudioEvent(message) {

    let content = message;


    if (content.startsWith("AUDIO:")) {

        content =
            content.substring(6);

    }

    else if (content.startsWith("EVENT:")) {

        content =
            content.substring(6);

    }


    const data = {};


    content
        .split(",")
        .forEach(function (part) {

            const index =
                part.indexOf(":");


            if (index === -1) {

                if (!data.event) {
                    data.event =
                        part.trim();
                }

                return;
            }


            const key =
                part.substring(
                    0,
                    index
                ).trim();


            const value =
                part.substring(
                    index + 1
                ).trim();


            data[key] = value;

        });


    const eventName =
        normalizeAudioEvent(
            data.event ||
            data.EVENT ||
            data.TYPE ||
            data.CLASS ||
            ""
        );


    const confidence =
        parseConfidence(
            data.CONF ||
            data.confidence ||
            0
        );


    const signal =
        data.SIG ||
        data.signal ||
        "Acoustic event detected";


    if (eventName) {

        showAudioEvent(
            eventName,
            confidence,
            signal
        );

    }

}


/* =========================================================
   NORMALIZE EVENT NAMES
========================================================= */

function normalizeAudioEvent(value) {

    const v =
        String(value)
            .toLowerCase()
            .trim()
            .replace(/[\s-]+/g, "_");


    if (
        v === "animal" ||
        v === "animal_hunting" ||
        v === "hunting" ||
        v === "wildlife" ||
        v === "animal_sound"
    ) {

        return "animal_hunting";

    }


    if (
        v === "gunshot" ||
        v === "gun_shot" ||
        v === "gunshot_sound" ||
        v === "bullet_sound"
    ) {

        return "gunshot_sound";

    }


    if (
        v === "chainsaw" ||
        v === "chain_saw" ||
        v === "tree_cutting" ||
        v === "tree_cutting_machine" ||
        v === "cutting_machine"
    ) {

        return "tree_cutting_machine";

    }


    if (
        v === "falling_tree" ||
        v === "tree_fall" ||
        v === "tree_falling"
    ) {

        return "falling_tree";

    }


    return null;

}


/* =========================================================
   CONFIDENCE
========================================================= */

function parseConfidence(value) {

    let number =
        parseFloat(value);


    if (Number.isNaN(number)) {
        return 0;
    }


    if (number <= 1) {
        number *= 100;
    }


    return Math.max(
        0,
        Math.min(
            100,
            number
        )
    );

}


/* =========================================================
   SHOW AUDIO EVENT
========================================================= */

function showAudioEvent(
    eventName,
    confidence,
    signal
) {

    const config =
        AUDIO_EVENTS[eventName];


    if (!config) {

        console.warn(
            "Unknown audio event:",
            eventName
        );

        return;
    }


    lastAudioEvent =
        eventName;


    /* Remove old detected state */

    Object.values(AUDIO_EVENTS)
        .forEach(function (event) {

            const card =
                document.getElementById(
                    event.cardId
                );

            const status =
                document.getElementById(
                    event.statusId
                );


            if (card) {

                card.classList.remove(
                    "detected"
                );

            }


            if (status) {

                status.textContent =
                    "NOT DETECTED";

            }

        });


    /* Activate current event */

    const card =
        document.getElementById(
            config.cardId
        );

    const status =
        document.getElementById(
            config.statusId
        );

    const confidenceElement =
        document.getElementById(
            config.confidenceId
        );


    if (card) {

        card.classList.add(
            "detected"
        );

    }


    if (status) {

        status.textContent =
            "DETECTED";

    }


    if (confidenceElement) {

        confidenceElement.textContent =
            confidence.toFixed(1) +
            "%";

    }


    /* Current detection */

    const currentEvent =
        document.getElementById(
            "currentAudioEvent"
        );

    const currentSignal =
        document.getElementById(
            "currentAudioSignal"
        );

    const currentConfidence =
        document.getElementById(
            "currentAudioConfidence"
        );


    if (currentEvent) {

        currentEvent.textContent =
            config.title;

    }


    if (currentSignal) {

        currentSignal.textContent =
            signal;

    }


    if (currentConfidence) {

        currentConfidence.textContent =
            confidence.toFixed(1) +
            "%";

    }


    const recognitionStatus =
        document.getElementById(
            "audioRecognitionStatus"
        );


    if (recognitionStatus) {

        recognitionStatus.textContent =
            "EVENT DETECTED";

    }


    /* Alert */

    addAlert(
        config.title,
        signal +
        " | Confidence: " +
        confidence.toFixed(1) +
        "%"
    );


    /* Emergency banner */

    if (
        eventName === "animal_hunting" ||
        eventName === "gunshot_sound" ||
        eventName === "tree_cutting_machine" ||
        eventName === "falling_tree"
    ) {

        triggerEmergency(
            config.title,
            signal
        );

    }


    /* Update old animal section */

    if (
        eventName ===
        "animal_hunting"
    ) {

        updateAnimalCompatibility(
            confidence,
            signal
        );

    }


    updateRecognitionStatus(
        "ALERT"
    );

}


/* =========================================================
   ANIMAL COMPATIBILITY
========================================================= */

function updateAnimalCompatibility(
    confidence,
    signal
) {

    const card =
        document.getElementById(
            "animalSignalCard"
        );

    const title =
        document.getElementById(
            "animalDangerStatusTitle"
        );

    const subtitle =
        document.getElementById(
            "animalDangerSubText"
        );

    const badge =
        document.getElementById(
            "animalStatusBadge"
        );

    const badgeText =
        document.getElementById(
            "animalBadgeText"
        );

    const confidenceText =
        document.getElementById(
            "animalConfidenceVal"
        );

    const confidenceBar =
        document.getElementById(
            "animalConfidenceBar"
        );

    const match =
        document.getElementById(
            "animalLastMatch"
        );


    if (card) {

        card.className =
            "animal-danger md:col-span-2";

    }


    if (title) {

        title.textContent =
            "ANIMAL / HUNTING SOUND DETECTED";

        title.className =
            "text-xl font-extrabold text-rose-400";

    }


    if (subtitle) {

        subtitle.textContent =
            signal;

    }


    if (badge) {

        badge.className =
            "animal-badge danger";

    }


    if (badgeText) {

        badgeText.textContent =
            "ALERT / RED";

    }


    if (confidenceText) {

        confidenceText.textContent =
            confidence.toFixed(1) +
            "%";

    }


    if (confidenceBar) {

        confidenceBar.style.width =
            confidence + "%";

    }


    if (match) {

        match.textContent =
            "Animal / Hunting";

    }

}


/* =========================================================
   OLD ANIMAL PACKET SUPPORT
========================================================= */

function parseAnimalData(message) {

    const content =
        message.substring(
            "ANIMAL:".length
        );


    const data = {};


    content
        .split(",")
        .forEach(function (part) {

            const index =
                part.indexOf(":");


            if (index === -1) {
                return;
            }


            const key =
                part.substring(
                    0,
                    index
                ).trim();


            const value =
                part.substring(
                    index + 1
                ).trim();


            data[key] = value;

        });


    const animal =
        String(
            data.ANIMAL ||
            "CLEAR"
        ).toUpperCase();


    const confidence =
        parseConfidence(
            data.CONF || 0
        );


    const signal =
        data.SIG ||
        "Animal sound";


    if (
        animal === "DANGER"
    ) {

        showAudioEvent(
            "animal_hunting",
            confidence,
            signal
        );

    }

}


/* =========================================================
   GPS
========================================================= */

function parseGPSData(message) {

    const content =
        message.substring(4);


    const data = {};


    content
        .split(",")
        .forEach(function (part) {

            const index =
                part.indexOf(":");


            if (index === -1) {
                return;
            }


            const key =
                part.substring(
                    0,
                    index
                ).trim();


            const value =
                part.substring(
                    index + 1
                ).trim();


            data[key] = value;

        });


    const lat =
        parseFloat(data.LAT);


    const lng =
        parseFloat(data.LNG);


    const acc =
        parseFloat(data.ACC);


    if (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng)
    ) {

        updateMapMarker(
            lat,
            lng
        );

    }


    updateGPSDisplay(
        lat,
        lng,
        Number.isNaN(acc)
            ? null
            : acc,
        true
    );

}


/* =========================================================
   GPS MAP
========================================================= */

function initializeGPSMap() {

    const mapElement =
        document.getElementById(
            "gpsMap"
        );


    if (!mapElement) {

        return;

    }


    if (
        typeof L === "undefined"
    ) {

        console.warn(
            "Leaflet not loaded"
        );

        return;

    }


    const latitude =
        23.2599;

    const longitude =
        77.4126;


    gpsMap =
        L.map(
            "gpsMap"
        ).setView(
            [
                latitude,
                longitude
            ],
            13
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap"
        }
    ).addTo(gpsMap);


    gpsMarker =
        L.marker(
            [
                latitude,
                longitude
            ]
        ).addTo(gpsMap);


    gpsMarker.bindPopup(
        "A.E.G.I.S. GPS Position"
    );


    updateGPSDisplay(
        latitude,
        longitude,
        null,
        false
    );

}


/* =========================================================
   UPDATE MAP
========================================================= */

function updateMapMarker(
    lat,
    lng
) {

    if (
        Number.isNaN(lat) ||
        Number.isNaN(lng)
    ) {

        return;

    }


    if (!gpsMap) {

        initializeGPSMap();

    }


    if (!gpsMap) {

        return;

    }


    if (!gpsMarker) {

        gpsMarker =
            L.marker(
                [
                    lat,
                    lng
                ]
            ).addTo(gpsMap);

    }

    else {

        gpsMarker.setLatLng(
            [
                lat,
                lng
            ]
        );

    }


    gpsMap.setView(
        [
            lat,
            lng
        ],
        15
    );


    updateGPSDisplay(
        lat,
        lng,
        null,
        true
    );

}


/* =========================================================
   GPS DISPLAY
========================================================= */

function updateGPSDisplay(
    lat,
    lng,
    accuracy,
    fix
) {

    const latElement =
        document.getElementById(
            "gpsLat"
        );

    const lngElement =
        document.getElementById(
            "gpsLng"
        );

    const accElement =
        document.getElementById(
            "gpsAcc"
        );

    const fixElement =
        document.getElementById(
            "gpsFix"
        );

    const statusElement =
        document.getElementById(
            "gpsStatus"
        );


    if (
        latElement &&
        !Number.isNaN(lat)
    ) {

        latElement.textContent =
            Number(lat).toFixed(6);

    }


    if (
        lngElement &&
        !Number.isNaN(lng)
    ) {

        lngElement.textContent =
            Number(lng).toFixed(6);

    }


    if (
        accElement &&
        accuracy !== null
    ) {

        accElement.textContent =
            Number(accuracy).toFixed(1) +
            " m";

    }


    if (fixElement) {

        fixElement.textContent =
            fix
                ? "FIXED"
                : "NO FIX";

    }


    if (statusElement) {

        statusElement.textContent =
            fix
                ? "GPS ACTIVE"
                : "GPS SEARCHING";

    }

}


/* =========================================================
   CHART
========================================================= */

function initializeTemperatureChart() {

    const canvas =
        document.getElementById(
            "envChart"
        );


    if (!canvas) {

        return;

    }


    if (
        typeof Chart === "undefined"
    ) {

        console.warn(
            "Chart.js not loaded"
        );

        return;

    }


    const context =
        canvas.getContext("2d");


    chart =
        new Chart(
            context,
            {
                type: "line",

                data: {

                    labels: [],

                    datasets: [

                        {
                            label:
                                "Temperature °C",

                            data: [],

                            tension: 0.35,

                            borderWidth: 2,

                            pointRadius: 2
                        },

                        {
                            label:
                                "Humidity %",

                            data: [],

                            tension: 0.35,

                            borderWidth: 2,

                            pointRadius: 2
                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    animation: false

                }

            }
        );

}


/* =========================================================
   CHART DATA
========================================================= */

function addTemperatureData(
    temperature,
    humidity
) {

    const now =
        new Date()
            .toLocaleTimeString();


    timeHistory.push(now);

    temperatureHistory.push(
        temperature
    );


    if (
        humidity !== null &&
        humidity !== undefined
    ) {

        humidityHistory.push(
            humidity
        );

    }


    limitChartData();

    refreshChart();

}


function addHumidityData(
    humidity
) {

    humidityHistory.push(
        humidity
    );


    while (
        humidityHistory.length >
        20
    ) {

        humidityHistory.shift();

    }


    refreshChart();

}


function limitChartData() {

    while (
        temperatureHistory.length >
        20
    ) {

        temperatureHistory.shift();

    }


    while (
        humidityHistory.length >
        20
    ) {

        humidityHistory.shift();

    }


    while (
        timeHistory.length >
        20
    ) {

        timeHistory.shift();

    }

}


function refreshChart() {

    if (!chart) {

        return;

    }


    chart.data.labels =
        timeHistory;


    chart.data.datasets[0].data =
        temperatureHistory;


    chart.data.datasets[1].data =
        humidityHistory;


    chart.update();

}


/* =========================================================
   SIMULATION
========================================================= */

function toggleSimulation() {

    if (simulationRunning) {

        stopSimulation();

    }

    else {

        startSimulation();

    }

}


function startSimulation() {

    if (simulationRunning) {

        return;

    }


    simulationRunning = true;


    const button =
        document.getElementById(
            "simulateBtn"
        );

    const buttonText =
        document.getElementById(
            "simulateBtnText"
        );


    if (button) {

        button.classList.add(
            "running"
        );

    }


    if (buttonText) {

        buttonText.textContent =
            "STOP SIMULATION";

    }


    addToSerialLog(
        "SIMULATION: Started"
    );


    runSimulationStep();


    simulationTimer =
        setInterval(
            runSimulationStep,
            3000
        );

}


function stopSimulation() {

    simulationRunning =
        false;


    if (simulationTimer) {

        clearInterval(
            simulationTimer
        );

        simulationTimer = null;

    }


    const button =
        document.getElementById(
            "simulateBtn"
        );

    const buttonText =
        document.getElementById(
            "simulateBtnText"
        );


    if (button) {

        button.classList.remove(
            "running"
        );

    }


    if (buttonText) {

        buttonText.textContent =
            "SIMULATE SENSOR DATA";

    }


    addToSerialLog(
        "SIMULATION: Stopped"
    );

}


/* =========================================================
   SIMULATION STEP
========================================================= */

function runSimulationStep() {

    const temperature =
        24 +
        Math.random() * 8;


    const humidity =
        45 +
        Math.random() * 30;


    const gas =
        Math.floor(
            150 +
            Math.random() * 250
        );


    const distance =
        Math.floor(
            20 +
            Math.random() * 120
        );


    const pir =
        Math.random() < 0.15
            ? "MOTION"
            : "CLEAR";


    const flame =
        Math.random() < 0.03
            ? "FIRE"
            : "CLEAR";


    const ldr =
        Math.random() < 0.08
            ? "BROKEN"
            : "OK";


    updateTemperature(
        temperature
    );

    updateHumidity(
        humidity
    );

    updateGas(
        gas
    );

    updateDistance(
        distance
    );

    updatePIR(
        pir
    );

    updateFlame(
        flame
    );

    updateLDR(
        ldr
    );


    /* Simulate acoustic events */

    if (
        Math.random() < 0.35
    ) {

        const events =
            [
                "animal_hunting",
                "gunshot_sound",
                "tree_cutting_machine",
                "falling_tree"
            ];


        const event =
            events[
                Math.floor(
                    Math.random() *
                    events.length
                )
            ];


        const confidence =
            80 +
            Math.random() * 19;


        showAudioEvent(
            event,
            confidence,
            "Simulation acoustic event"
        );


        addToSerialLog(
            "EVENT:" +
            event +
            ",CONF:" +
            confidence.toFixed(1)
        );

    }

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    connected
) {

    const status =
        document.getElementById(
            "statusText"
        );

    const dot =
        document.getElementById(
            "statusDot"
        );

    const buttonText =
        document.getElementById(
            "connectBtnText"
        );


    if (connected) {

        if (status) {

            status.textContent =
                "CONNECTED";

        }


        if (dot) {

            dot.classList.remove(
                "bg-amber-500"
            );

            dot.classList.add(
                "bg-emerald-500"
            );

        }


        if (buttonText) {

            buttonText.textContent =
                "Disconnect USB Serial";

        }

    }

    else {

        if (status) {

            status.textContent =
                "DISCONNECTED";

        }


        if (dot) {

            dot.classList.remove(
                "bg-emerald-500"
            );

            dot.classList.add(
                "bg-amber-500"
            );

        }


        if (buttonText) {

            buttonText.textContent =
                "Connect USB Serial";

        }

    }

}


/* =========================================================
   RECOGNITION STATUS
========================================================= */

function updateRecognitionStatus(
    status
) {

    const element =
        document.getElementById(
            "audioRecognitionStatus"
        );


    if (!element) {

        return;

    }


    element.textContent =
        status === "ALERT"
            ? "EVENT DETECTED"
            : "WAITING FOR AUDIO";

}


/* =========================================================
   ALERT LOG
========================================================= */

function addAlert(
    title,
    message
) {

    const log =
        document.getElementById(
            "alertLogConsole"
        );


    if (!log) {

        return;

    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "mb-2";


    item.innerHTML =
        "<div class='font-bold text-rose-400'>" +
        escapeHTML(title) +
        "</div>" +

        "<div class='text-slate-300'>" +
        escapeHTML(message) +
        "</div>" +

        "<div class='text-slate-600'>" +
        new Date().toLocaleTimeString() +
        "</div>";


    log.prepend(item);


    while (
        log.children.length >
        50
    ) {

        log.removeChild(
            log.lastChild
        );

    }

}


/* =========================================================
   SERIAL LOG
========================================================= */

function addToSerialLog(
    message
) {

    const log =
        document.getElementById(
            "rawSerialConsole"
        );


    if (!log) {

        return;

    }


    const line =
        document.createElement(
            "div"
        );


    line.textContent =
        "[" +
        new Date().toLocaleTimeString() +
        "] " +
        message;


    log.prepend(line);


    while (
        log.children.length >
        100
    ) {

        log.removeChild(
            log.lastChild
        );

    }

}


/* =========================================================
   EMERGENCY
========================================================= */

function triggerEmergency(
    title,
    subtitle
) {

    const banner =
        document.getElementById(
            "emergencyBanner"
        );


    const emergencyTitle =
        document.getElementById(
            "emergencyTitle"
        );


    const emergencySubtitle =
        document.getElementById(
            "emergencySubtitle"
        );


    if (!banner) {

        return;

    }


    if (emergencyTitle) {

        emergencyTitle.textContent =
            title;

    }


    if (emergencySubtitle) {

        emergencySubtitle.textContent =
            subtitle;

    }


    banner.classList.remove(
        "hidden"
    );


    setTimeout(
        function () {

            banner.classList.add(
                "hidden"
            );

        },
        5000
    );

}


/* =========================================================
   MUTE
========================================================= */

function toggleMuteAudio() {

    alertMuted =
        !alertMuted;


    const text =
        document.getElementById(
            "muteBtnText"
        );


    const icon =
        document.getElementById(
            "muteIcon"
        );


    if (text) {

        text.textContent =
            alertMuted
                ? "Unmute Alarm"
                : "Mute Alarm";

    }


    if (icon) {

        icon.className =
            alertMuted
                ? "fa-solid fa-volume-xmark"
                : "fa-solid fa-volume-high";

    }


    addToSerialLog(
        alertMuted
            ? "SYSTEM: Alerts muted"
            : "SYSTEM: Alerts unmuted"
    );

}


/* =========================================================
   RADAR ANIMATION
========================================================= */

function startRadarAnimation() {

    const canvas =
        document.getElementById(
            "radarCanvas"
        );


    if (!canvas) {

        return;

    }


    const ctx =
        canvas.getContext("2d");


    function draw() {

        const width =
            canvas.width;

        const height =
            canvas.height;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        const centerX =
            width / 2;

        const centerY =
            height / 2;


        const radius =
            Math.min(
                width,
                height
            ) * 0.38;


        for (
            let i = 1;
            i <= 3;
            i++
        ) {

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                radius *
                (i / 3),
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                "rgba(16,185,129,0.35)";

            ctx.stroke();

        }


        const endX =
            centerX +
            Math.cos(radarAngle) *
            radius;


        const endY =
            centerY +
            Math.sin(radarAngle) *
            radius;


        ctx.beginPath();

        ctx.moveTo(
            centerX,
            centerY
        );

        ctx.lineTo(
            endX,
            endY
        );

        ctx.strokeStyle =
            "rgba(16,185,129,0.9)";

        ctx.lineWidth = 2;

        ctx.stroke();


        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
            4,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(16,185,129,1)";

        ctx.fill();


        radarAngle += 0.025;


        requestAnimationFrame(
            draw
        );

    }


    draw();

}


/* =========================================================
   SOUND WAVE
========================================================= */

function startSoundAnimation() {

    const canvas =
        document.getElementById(
            "soundCanvas"
        );


    if (!canvas) {

        return;

    }


    const ctx =
        canvas.getContext("2d");


    function draw() {

        const width =
            canvas.width;

        const height =
            canvas.height;


        ctx.clearRect(
            0,
            0,
            width,
            height
        );


        ctx.beginPath();


        for (
            let x = 0;
            x < width;
            x += 2
        ) {

            const y =
                height / 2 +
                Math.sin(
                    x * 0.08 +
                    soundPhase
                ) *
                height *
                0.25;


            if (x === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            }

            else {

                ctx.lineTo(
                    x,
                    y
                );

            }

        }


        ctx.strokeStyle =
            "rgba(56,189,248,0.9)";

        ctx.lineWidth = 2;

        ctx.stroke();


        soundPhase += 0.08;


        requestAnimationFrame(
            draw
        );

    }


    draw();

}


/* =========================================================
   CLEAR LOGS
========================================================= */

function clearLogs() {

    const serialLog =
        document.getElementById(
            "rawSerialConsole"
        );

    const alertLog =
        document.getElementById(
            "alertLogConsole"
        );


    if (serialLog) {

        serialLog.innerHTML = "";

    }


    if (alertLog) {

        alertLog.innerHTML = "";

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   TEST FUNCTIONS
=========================================================

You can type these in the browser console:

testAnimal()
testGunshot()
testTreeCutting()
testFallingTree()

========================================================= */

function testAnimal() {

    showAudioEvent(
        "animal_hunting",
        94,
        "Animal acoustic signature"
    );

}


function testGunshot() {

    showAudioEvent(
        "gunshot_sound",
        92,
        "Gunshot acoustic signature"
    );

}


function testTreeCutting() {

    showAudioEvent(
        "tree_cutting_machine",
        96,
        "Tree cutting machine acoustic signature"
    );

}


function testFallingTree() {

    showAudioEvent(
        "falling_tree",
        90,
        "Falling tree acoustic signature"
    );

}


/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.toggleSerialConnection =
    toggleSerialConnection;

window.disconnectSerial =
    disconnectSerial;

window.toggleSimulation =
    toggleSimulation;

window.clearLogs =
    clearLogs;

window.toggleMuteAudio =
    toggleMuteAudio;

window.testAnimal =
    testAnimal;

window.testGunshot =
    testGunshot;

window.testTreeCutting =
    testTreeCutting;

window.testFallingTree =
    testFallingTree;
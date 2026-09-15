"use strict";

/* =========================================================
   A.E.G.I.S. FOREST PROTECTION DASHBOARD
   COMPLETE JAVASCRIPT
   AUDIO + VISUAL ALERT SYSTEM
========================================================= */


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let serialPort = null;
let serialReader = null;
let serialConnected = false;

let simulationRunning = false;
let simulationTimer = null;

let chart = null;

let radarAngle = 0;
let soundPhase = 0;

let alertMuted = false;
let audioEnabled = false;
let dashboardAudioContext = null;

let temperatureHistory = [];
let humidityHistory = [];
let timeHistory = [];

let lastAudioEvent = null;
let lastAlertTime = 0;


/* =========================================================
   AUDIO EVENT CONFIGURATION
========================================================= */

const AUDIO_EVENTS = {

    animal_hunting: {
        title: "ANIMAL / HUNTING",
        statusId: "animalEventStatus",
        confidenceId: "animalEventConfidence",
        cardId: "animalEventCard",
        icon: "🐾",
        frequency: 620
    },

    gunshot_sound: {
        title: "GUNSHOT SOUND",
        statusId: "gunshotEventStatus",
        confidenceId: "gunshotEventConfidence",
        cardId: "gunshotEventCard",
        icon: "🔊",
        frequency: 950
    },

    tree_cutting_machine: {
        title: "TREE CUTTING MACHINE",
        statusId: "treeCuttingEventStatus",
        confidenceId: "treeCuttingEventConfidence",
        cardId: "treeCuttingEventCard",
        icon: "🌲",
        frequency: 520
    },

    falling_tree: {
        title: "FALLING TREE",
        statusId: "fallingTreeEventStatus",
        confidenceId: "fallingTreeEventConfidence",
        cardId: "fallingTreeEventCard",
        icon: "🌳",
        frequency: 380
    }

};


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "A.E.G.I.S. Dashboard loaded"
        );

        injectAudioStyles();

        createAudioEnableButton();

        initializeTemperatureChart();

        startRadarAnimation();

        startSoundAnimation();

        updateConnectionStatus(false);

        addToSerialLog(
            "SYSTEM: A.E.G.I.S. dashboard initialized"
        );

        addToSerialLog(
            "SYSTEM: Waiting for Arduino telemetry..."
        );

    }
);


/* =========================================================
   AUDIO BUTTON
========================================================= */

function createAudioEnableButton() {

    const header =
        document.querySelector(
            "header .flex.items-center.flex-wrap.gap-2"
        );

    if (!header) {
        return;
    }

    if (
        document.getElementById(
            "dashboardAudioBtn"
        )
    ) {
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "dashboardAudioBtn";

    button.innerHTML =
        '<i class="fa-solid fa-volume-high"></i> ' +
        '<span>ENABLE ALERT SOUND</span>';

    button.className =
        "px-4 py-2 bg-emerald-600 " +
        "hover:bg-emerald-500 text-white " +
        "rounded-lg text-xs font-bold " +
        "shadow-lg";

    button.onclick =
        enableDashboardAudio;

    header.insertBefore(
        button,
        header.firstChild
    );

}


/* =========================================================
   ENABLE AUDIO
========================================================= */

function enableDashboardAudio() {

    try {

        if (!dashboardAudioContext) {

            dashboardAudioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }

        if (
            dashboardAudioContext.state ===
            "suspended"
        ) {

            dashboardAudioContext.resume();

        }

        audioEnabled = true;

        const button =
            document.getElementById(
                "dashboardAudioBtn"
            );

        if (button) {

            button.innerHTML =
                '<i class="fa-solid fa-volume-high"></i> ' +
                '<span>ALERT SOUND ON</span>';

            button.classList.remove(
                "bg-emerald-600"
            );

            button.classList.add(
                "bg-blue-600"
            );

        }

        addToSerialLog(
            "SYSTEM: Dashboard alert sound enabled"
        );

        playDashboardTone(
            700,
            120
        );

    }

    catch (error) {

        console.error(
            "Audio initialization error:",
            error
        );

        addToSerialLog(
            "ERROR: Could not enable dashboard audio"
        );

    }

}


/* =========================================================
   PLAY DASHBOARD TONE
========================================================= */

function playDashboardTone(
    frequency,
    duration
) {

    if (!audioEnabled) {
        return;
    }

    if (!dashboardAudioContext) {
        return;
    }

    try {

        const oscillator =
            dashboardAudioContext.createOscillator();

        const gain =
            dashboardAudioContext.createGain();

        oscillator.type =
            "sine";

        oscillator.frequency.setValueAtTime(
            frequency,
            dashboardAudioContext.currentTime
        );

        gain.gain.setValueAtTime(
            0.001,
            dashboardAudioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.25,
            dashboardAudioContext.currentTime + 0.02
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            dashboardAudioContext.currentTime +
            duration / 1000
        );

        oscillator.connect(gain);

        gain.connect(
            dashboardAudioContext.destination
        );

        oscillator.start();

        oscillator.stop(
            dashboardAudioContext.currentTime +
            duration / 1000 +
            0.05
        );

    }

    catch (error) {

        console.warn(
            "Audio tone failed:",
            error
        );

    }

}


/* =========================================================
   EVENT ALERT SOUND
========================================================= */

function playAudioEventAlert(
    eventName
) {

    if (
        !audioEnabled ||
        alertMuted
    ) {
        return;
    }

    const config =
        AUDIO_EVENTS[eventName];

    if (!config) {
        return;
    }

    playDashboardTone(
        config.frequency,
        180
    );

    setTimeout(
        function () {

            if (
                audioEnabled &&
                !alertMuted
            ) {

                playDashboardTone(
                    config.frequency * 0.72,
                    220
                );

            }

        },
        220
    );

}


/* =========================================================
   INJECT VISUAL ALERT CSS
========================================================= */

function injectAudioStyles() {

    if (
        document.getElementById(
            "aegisAudioStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "aegisAudioStyles";

    style.textContent = `

        /* AUDIO ALERT FLASH */

        body.aegis-audio-alert {
            animation:
                aegisScreenFlash
                0.35s
                ease-in-out
                4;
        }

        @keyframes aegisScreenFlash {

            0% {
                box-shadow:
                    inset 0 0 0
                    rgba(239,68,68,0);
            }

            50% {
                box-shadow:
                    inset 0 0 80px
                    rgba(239,68,68,0.35);
            }

            100% {
                box-shadow:
                    inset 0 0 0
                    rgba(239,68,68,0);
            }

        }


        /* DETECTED CARD */

        .event-card.detected {

            animation:
                aegisCardPulse
                0.65s
                ease-in-out
                infinite
                alternate;

            border-color:
                rgba(239,68,68,0.95) !important;

            box-shadow:
                0 0 15px
                rgba(239,68,68,0.7),
                0 0 40px
                rgba(239,68,68,0.25);

        }


        @keyframes aegisCardPulse {

            from {
                transform:
                    scale(1);
            }

            to {
                transform:
                    scale(1.035);
            }

        }


        /* AUDIO TOAST */

        .aegis-audio-toast {

            position: fixed;

            top: 90px;

            right: 20px;

            width: 330px;

            z-index: 99999;

            padding: 18px;

            border-radius: 15px;

            background:
                rgba(15,23,42,0.97);

            border:
                2px solid
                rgba(239,68,68,0.95);

            box-shadow:
                0 0 20px
                rgba(239,68,68,0.65),
                0 0 55px
                rgba(239,68,68,0.25);

            animation:
                aegisToastIn
                0.3s
                ease-out;

        }


        @keyframes aegisToastIn {

            from {
                opacity: 0;
                transform:
                    translateX(60px);
            }

            to {
                opacity: 1;
                transform:
                    translateX(0);
            }

        }


        /* WAVE ALERT */

        .sound-canvas.aegis-wave-alert {

            filter:
                drop-shadow(
                    0 0 8px
                    rgba(239,68,68,0.95)
                )
                drop-shadow(
                    0 0 22px
                    rgba(239,68,68,0.65)
                );

        }


        /* AUDIO STATUS */

        .aegis-audio-status {

            display: inline-flex;

            align-items: center;

            gap: 8px;

        }


        .aegis-audio-dot {

            width: 9px;

            height: 9px;

            border-radius: 50%;

            background:
                #22c55e;

            box-shadow:
                0 0 10px
                rgba(34,197,94,0.8);

        }


        .aegis-audio-dot.alert {

            background:
                #ef4444;

            box-shadow:
                0 0 12px
                rgba(239,68,68,0.9);

            animation:
                aegisDotPulse
                0.4s
                infinite
                alternate;

        }


        @keyframes aegisDotPulse {

            from {
                transform:
                    scale(1);
            }

            to {
                transform:
                    scale(1.7);
            }

        }


        /* CURRENT EVENT */

        .aegis-current-alert {

            color:
                #fb7185 !important;

            text-shadow:
                0 0 12px
                rgba(251,113,133,0.7);

        }

    `;

    document.head.appendChild(
        style
    );

}


/* =========================================================
   SERIAL CONNECTION
========================================================= */

async function toggleSerialConnection() {

    if (serialConnected) {

        await disconnectSerial();

    }

    else {

        await connectSerial();

    }

}


/* =========================================================
   CONNECT SERIAL
========================================================= */

async function connectSerial() {

    if (
        !("serial" in navigator)
    ) {

        alert(
            "Web Serial is not supported.\n\n" +
            "Please use Google Chrome or Microsoft Edge."
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

        updateConnectionStatus(
            true
        );

        addToSerialLog(
            "SYSTEM: USB Serial connected"
        );

        readSerialLoop();

    }

    catch (error) {

        console.error(error);

        addToSerialLog(
            "ERROR: " +
            error.message
        );

        updateConnectionStatus(
            false
        );

    }

}


/* =========================================================
   DISCONNECT SERIAL
========================================================= */

async function disconnectSerial() {

    try {

        serialConnected =
            false;

        if (serialReader) {

            try {

                await serialReader.cancel();

            }

            catch (e) {}

            try {

                serialReader.releaseLock();

            }

            catch (e) {}

            serialReader = null;

        }

        if (serialPort) {

            try {

                await serialPort.close();

            }

            catch (e) {}

            serialPort = null;

        }

    }

    catch (error) {

        console.error(error);

    }

    finally {

        updateConnectionStatus(
            false
        );

        addToSerialLog(
            "SYSTEM: USB Serial disconnected"
        );

    }

}


/* =========================================================
   SERIAL READER
========================================================= */

async function readSerialLoop() {

    if (
        !serialPort ||
        !serialPort.readable
    ) {
        return;
    }

    const decoder =
        new TextDecoder();

    serialReader =
        serialPort.readable.getReader();

    let buffer = "";

    try {

        while (
            serialConnected
        ) {

            const result =
                await serialReader.read();

            const value =
                result.value;

            const done =
                result.done;

            if (done) {
                break;
            }

            if (!value) {
                continue;
            }

            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );

            const lines =
                buffer.split(
                    /\r?\n/
                );

            buffer =
                lines.pop() || "";

            for (
                const line of lines
            ) {

                const message =
                    line.trim();

                if (
                    message.length > 0
                ) {

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

function processSerialMessage(
    message
) {

    addToSerialLog(
        message
    );


    if (
        message.startsWith(
            "TELEMETRY:"
        )
    ) {

        parseTelemetry(
            message
        );

        return;

    }


    if (
        message.startsWith(
            "AUDIO:"
        )
    ) {

        parseAudioEvent(
            message
        );

        return;

    }


    if (
        message.startsWith(
            "EVENT:"
        )
    ) {

        parseAudioEvent(
            message
        );

        return;

    }


    if (
        message.startsWith(
            "ANIMAL:"
        )
    ) {

        parseAnimalData(
            message
        );

        return;

    }


    if (
        message.startsWith(
            "GPS:"
        )
    ) {

        parseGPSData(
            message
        );

        return;

    }


    if (
        message.startsWith("{") &&
        message.endsWith("}")
    ) {

        try {

            const data =
                JSON.parse(
                    message
                );

            if (
                data.event
            ) {

                const eventName =
                    normalizeAudioEvent(
                        data.event
                    );

                if (eventName) {

                    showAudioEvent(
                        eventName,
                        parseConfidence(
                            data.confidence
                        ),
                        data.signal ||
                        "Audio event detected"
                    );

                }

            }

        }

        catch (error) {

            console.warn(
                "Invalid JSON"
            );

        }

    }

}


/* =========================================================
   TELEMETRY PARSER
========================================================= */

function parseTelemetry(
    message
) {

    const content =
        message.substring(
            "TELEMETRY:".length
        );

    const data = {};

    content
        .split(",")
        .forEach(
            function (part) {

                const index =
                    part.indexOf(":");

                if (
                    index === -1
                ) {
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

                data[key] =
                    value;

            }
        );


    if (
        data.PIR !== undefined
    ) {

        updatePIR(
            data.PIR
        );

    }


    if (
        data.FLAME !== undefined
    ) {

        updateFlame(
            data.FLAME
        );

    }


    if (
        data.GAS !== undefined
    ) {

        updateGas(
            data.GAS
        );

    }


    if (
        data.DIST !== undefined
    ) {

        updateDistance(
            data.DIST
        );

    }


    if (
        data.TEMP !== undefined
    ) {

        updateTemperature(
            data.TEMP
        );

    }


    if (
        data.HUM !== undefined
    ) {

        updateHumidity(
            data.HUM
        );

    }


    if (
        data.MIC !== undefined
    ) {

        updateSoundStatus(
            data.MIC
        );

    }


    if (
        data.LDR !== undefined
    ) {

        updateLDR(
            data.LDR
        );

    }


    if (
        data.SOUND !== undefined
    ) {

        updateSoundStatus(
            data.SOUND
        );

    }

}


/* =========================================================
   LDR
========================================================= */

function updateLDR(
    value
) {

    const badge =
        document.getElementById(
            "laserBadge"
        );

    const text =
        document.getElementById(
            "laserStatusText"
        );

    if (
        !badge ||
        !text
    ) {
        return;
    }

    const v =
        String(value)
            .toUpperCase();


    if (
        v === "OK" ||
        v === "CLEAR" ||
        v === "SAFE"
    ) {

        badge.textContent =
            "SAFE";

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

function updatePIR(
    value
) {

    const badge =
        document.getElementById(
            "pirBadge"
        );

    const text =
        document.getElementById(
            "pirStatusText"
        );

    if (
        !badge ||
        !text
    ) {
        return;
    }

    const v =
        String(value)
            .toUpperCase();


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

function updateFlame(
    value
) {

    const badge =
        document.getElementById(
            "flameBadge"
        );

    const text =
        document.getElementById(
            "flameStatusText"
        );

    if (
        !badge ||
        !text
    ) {
        return;
    }

    const v =
        String(value)
            .toUpperCase();


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
   GAS / SMOKE
========================================================= */

function updateGas(
    value
) {

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

    if (
        !display ||
        !badge ||
        Number.isNaN(numeric)
    ) {
        return;
    }

    display.textContent =
        Math.round(numeric) +
        " ADC";


    if (
        numeric > 700
    ) {

        badge.textContent =
            "DANGER";

        addAlert(
            "GAS ALERT",
            "High gas/smoke level"
        );

    }

    else if (
        numeric > 400
    ) {

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

function updateDistance(
    value
) {

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


    if (
        distance < 20
    ) {

        zone.textContent =
            "OBJECT VERY NEAR";

    }

    else if (
        distance < 50
    ) {

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

function updateTemperature(
    value
) {

    const temperature =
        parseFloat(value);

    const display =
        document.getElementById(
            "tempValDisplay"
        );

    if (
        !display ||
        Number.isNaN(
            temperature
        )
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

function updateHumidity(
    value
) {

    const humidity =
        parseFloat(value);

    const display =
        document.getElementById(
            "humidityValDisplay"
        );

    if (
        !display ||
        Number.isNaN(
            humidity
        )
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

function updateSoundStatus(
    value
) {

    const badge =
        document.getElementById(
            "soundBadge"
        );

    const status =
        document.getElementById(
            "soundDistressStatus"
        );

    if (
        !badge ||
        !status
    ) {
        return;
    }

    badge.textContent =
        String(value);

    status.textContent =
        "Microphone level: " +
        String(value);

}


/* =========================================================
   AUDIO EVENT PARSER
========================================================= */

function parseAudioEvent(
    message
) {

    let content =
        message;

    if (
        content.startsWith(
            "AUDIO:"
        )
    ) {

        content =
            content.substring(
                6
            );

    }

    else if (
        content.startsWith(
            "EVENT:"
        )
    ) {

        content =
            content.substring(
                6
            );

    }


    const data = {};


    content
        .split(",")
        .forEach(
            function (part) {

                const index =
                    part.indexOf(":");

                if (
                    index === -1
                ) {

                    if (
                        !data.event
                    ) {

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

                data[key] =
                    value;

            }
        );


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
   NORMALIZE AUDIO EVENT
========================================================= */

function normalizeAudioEvent(
    value
) {

    const v =
        String(value)
            .toLowerCase()
            .trim()
            .replace(
                /[\s-]+/g,
                "_"
            );


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
        v === "bullet" ||
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

function parseConfidence(
    value
) {

    let number =
        parseFloat(value);

    if (
        Number.isNaN(number)
    ) {

        return 0;

    }


    if (
        number <= 1
    ) {

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

    lastAlertTime =
        Date.now();


    /* ==============================================
       SOUND ALERT
    ============================================== */

    playAudioEventAlert(
        eventName
    );


    /* ==============================================
       REMOVE OLD EVENT STATES
    ============================================== */

    Object.values(
        AUDIO_EVENTS
    )
    .forEach(
        function (event) {

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

        }
    );


    /* ==============================================
       ACTIVATE EVENT CARD
    ============================================== */

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
            "🔴 DETECTED";

    }


    if (confidenceElement) {

        confidenceElement.textContent =
            confidence.toFixed(1) +
            "%";

    }


    /* ==============================================
       CURRENT DETECTION
    ============================================== */

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
            config.icon +
            " " +
            config.title;

        currentEvent.classList.add(
            "aegis-current-alert"
        );

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


    /* ==============================================
       RECOGNITION STATUS
    ============================================== */

    const recognitionStatus =
        document.getElementById(
            "audioRecognitionStatus"
        );

    if (recognitionStatus) {

        recognitionStatus.innerHTML =
            '<span class="aegis-audio-status">' +
            '<span class="aegis-audio-dot alert"></span>' +
            "EVENT DETECTED" +
            "</span>";

    }


    /* ==============================================
       SOUND WAVE VISUAL
    ============================================== */

    const soundCanvas =
        document.getElementById(
            "soundCanvas"
        );

    if (soundCanvas) {

        soundCanvas.classList.add(
            "aegis-wave-alert"
        );

        setTimeout(
            function () {

                soundCanvas.classList.remove(
                    "aegis-wave-alert"
                );

            },
            4000
        );

    }


    /* ==============================================
       SCREEN FLASH
    ============================================== */

    document.body.classList.remove(
        "aegis-audio-alert"
    );

    void document.body.offsetWidth;

    document.body.classList.add(
        "aegis-audio-alert"
    );

    setTimeout(
        function () {

            document.body.classList.remove(
                "aegis-audio-alert"
            );

        },
        1500
    );


    /* ==============================================
       ALERT LOG
    ============================================== */

    addAlert(
        config.title,
        signal +
        " | Confidence: " +
        confidence.toFixed(1) +
        "%"
    );


    /* ==============================================
       EMERGENCY BANNER
    ============================================== */

    triggerEmergency(
        config.title,
        signal
    );


    /* ==============================================
       ANIMAL COMPATIBILITY
    ============================================== */

    if (
        eventName ===
        "animal_hunting"
    ) {

        updateAnimalCompatibility(
            confidence,
            signal
        );

    }


    /* ==============================================
       POPUP
    ============================================== */

    showAudioToast(
        config,
        confidence,
        signal
    );

}


/* =========================================================
   AUDIO ALERT POPUP
========================================================= */

function showAudioToast(
    config,
    confidence,
    signal
) {

    const oldToast =
        document.querySelector(
            ".aegis-audio-toast"
        );

    if (oldToast) {

        oldToast.remove();

    }


    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "aegis-audio-toast";


    toast.innerHTML =

        '<div style="' +
        'font-size:11px;' +
        'font-weight:800;' +
        'letter-spacing:1px;' +
        'color:#fb7185;">' +

        "⚠ AUDIO EVENT DETECTED" +

        "</div>" +

        '<div style="' +
        'font-size:21px;' +
        'font-weight:900;' +
        'color:white;' +
        'margin-top:5px;">' +

        config.icon +
        " " +
        escapeHTML(
            config.title
        ) +

        "</div>" +

        '<div style="' +
        'font-size:12px;' +
        'color:#cbd5e1;' +
        'margin-top:7px;">' +

        escapeHTML(
            signal
        ) +

        "</div>" +

        '<div style="' +
        'font-size:11px;' +
        'color:#94a3b8;' +
        'margin-top:7px;">' +

        "Confidence: " +
        confidence.toFixed(1) +
        "%" +

        "</div>";


    document.body.appendChild(
        toast
    );


    setTimeout(
        function () {

            if (
                toast.parentNode
            ) {

                toast.remove();

            }

        },
        5000
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
            confidence +
            "%";

    }


    if (match) {

        match.textContent =
            "Animal / Hunting";

    }

}


/* =========================================================
   OLD ANIMAL PACKET
========================================================= */

function parseAnimalData(
    message
) {

    const content =
        message.substring(
            7
        );

    const data = {};

    content
        .split(",")
        .forEach(
            function (part) {

                const index =
                    part.indexOf(":");

                if (
                    index === -1
                ) {
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

                data[key] =
                    value;

            }
        );


    const animal =
        String(
            data.ANIMAL ||
            "CLEAR"
        )
        .toUpperCase();


    const confidence =
        parseConfidence(
            data.CONF ||
            0
        );


    const signal =
        data.SIG ||
        "Animal sound";


    if (
        animal ===
        "DANGER"
    ) {

        showAudioEvent(
            "animal_hunting",
            confidence,
            signal
        );

    }

}


/* =========================================================
   GPS DATA
========================================================= */

function parseGPSData(
    message
) {

    const content =
        message.substring(
            4
        );

    const data = {};

    content
        .split(",")
        .forEach(
            function (part) {

                const index =
                    part.indexOf(":");

                if (
                    index === -1
                ) {
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

                data[key] =
                    value;

            }
        );


    const lat =
        parseFloat(
            data.LAT
        );

    const lng =
        parseFloat(
            data.LNG
        );


    const gpsLat =
        document.getElementById(
            "gpsLat"
        );

    const gpsLng =
        document.getElementById(
            "gpsLng"
        );


    if (
        gpsLat &&
        !Number.isNaN(lat)
    ) {

        gpsLat.textContent =
            lat.toFixed(6);

    }


    if (
        gpsLng &&
        !Number.isNaN(lng)
    ) {

        gpsLng.textContent =
            lng.toFixed(6);

    }

}


/* =========================================================
   EMERGENCY BANNER
========================================================= */

function triggerEmergency(
    title,
    message
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


    if (banner) {

        banner.classList.remove(
            "hidden"
        );

    }


    if (emergencyTitle) {

        emergencyTitle.textContent =
            title;

    }


    if (emergencySubtitle) {

        emergencySubtitle.textContent =
            message;

    }

}


/* =========================================================
   MUTE / UNMUTE
========================================================= */

function toggleMuteAudio() {

    alertMuted =
        !alertMuted;


    const icon =
        document.getElementById(
            "muteIcon"
        );

    const text =
        document.getElementById(
            "muteBtnText"
        );


    if (alertMuted) {

        if (icon) {

            icon.className =
                "fa-solid fa-volume-xmark";

        }


        if (text) {

            text.textContent =
                "Unmute Alarm";

        }


        addToSerialLog(
            "SYSTEM: Audio alerts muted"
        );

    }

    else {

        if (icon) {

            icon.className =
                "fa-solid fa-volume-high";

        }


        if (text) {

            text.textContent =
                "Mute Alarm";

        }


        addToSerialLog(
            "SYSTEM: Audio alerts unmuted"
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


    if (
        status ===
        "ALERT"
    ) {

        element.innerHTML =
            '<span class="aegis-audio-status">' +
            '<span class="aegis-audio-dot alert"></span>' +
            "EVENT DETECTED" +
            "</span>";

    }

    else {

        element.innerHTML =
            '<span class="aegis-audio-status">' +
            '<span class="aegis-audio-dot"></span>' +
            "WAITING FOR AUDIO" +
            "</span>";

    }

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
        "mb-3";


    item.innerHTML =

        "<div class=" +
        "'font-bold text-rose-400'>" +

        escapeHTML(
            title
        ) +

        "</div>" +

        "<div class=" +
        "'text-slate-300'>" +

        escapeHTML(
            message
        ) +

        "</div>" +

        "<div class=" +
        "'text-slate-600'>" +

        new Date()
            .toLocaleTimeString() +

        "</div>";


    log.prepend(
        item
    );


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
        new Date()
            .toLocaleTimeString() +
        "] " +
        message;


    log.prepend(
        line
    );


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
   TEMPERATURE CHART
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
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js not loaded"
        );

        return;

    }


    const context =
        canvas.getContext(
            "2d"
        );


    chart =
        new Chart(
            context,
            {

                type:
                    "line",

                data: {

                    labels: [],

                    datasets: [

                        {
                            label:
                                "Temperature °C",

                            data: [],

                            tension:
                                0.35,

                            borderWidth:
                                2,

                            pointRadius:
                                2
                        },

                        {
                            label:
                                "Humidity %",

                            data: [],

                            tension:
                                0.35,

                            borderWidth:
                                2,

                            pointRadius:
                                2
                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    animation:
                        false

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


    timeHistory.push(
        now
    );

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


/* =========================================================
   HUMIDITY CHART DATA
========================================================= */

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


    while (
        timeHistory.length >
        humidityHistory.length
    ) {

        timeHistory.shift();

    }


    refreshChart();

}


/* =========================================================
   LIMIT CHART
========================================================= */

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


/* =========================================================
   REFRESH CHART
========================================================= */

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
        canvas.getContext(
            "2d"
        );


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
            ) *
            0.42;


        ctx.strokeStyle =
            "rgba(56,189,248,0.25)";

        ctx.lineWidth =
            1;


        for (
            let i = 1;
            i <= 4;
            i++
        ) {

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                radius *
                i /
                4,
                0,
                Math.PI * 2
            );

            ctx.stroke();

        }


        ctx.beginPath();

        ctx.moveTo(
            centerX -
            radius,
            centerY
        );

        ctx.lineTo(
            centerX +
            radius,
            centerY
        );

        ctx.stroke();


        ctx.beginPath();

        ctx.moveTo(
            centerX,
            centerY -
            radius
        );

        ctx.lineTo(
            centerX,
            centerY +
            radius
        );

        ctx.stroke();


        const endX =
            centerX +
            Math.cos(
                radarAngle
            ) *
            radius;

        const endY =
            centerY +
            Math.sin(
                radarAngle
            ) *
            radius;


        const gradient =
            ctx.createLinearGradient(
                centerX,
                centerY,
                endX,
                endY
            );


        gradient.addColorStop(
            0,
            "rgba(16,185,129,0.9)"
        );

        gradient.addColorStop(
            1,
            "rgba(16,185,129,0)"
        );


        ctx.strokeStyle =
            gradient;

        ctx.lineWidth =
            3;


        ctx.beginPath();

        ctx.moveTo(
            centerX,
            centerY
        );

        ctx.lineTo(
            endX,
            endY
        );

        ctx.stroke();


        ctx.fillStyle =
            "rgba(16,185,129,1)";

        ctx.beginPath();

        ctx.arc(
            centerX,
            centerY,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();


        radarAngle +=
            0.025;


        requestAnimationFrame(
            draw
        );

    }


    draw();

}


/* =========================================================
   SOUND WAVE ANIMATION
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
        canvas.getContext(
            "2d"
        );


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


        const alertActive =
            Date.now() -
            lastAlertTime <
            4000;


        ctx.beginPath();


        for (
            let x = 0;
            x < width;
            x += 2
        ) {

            let amplitude =
                height *
                0.23;


            if (
                alertActive
            ) {

                amplitude =
                    height *
                    0.42;

            }


            const y =
                height / 2 +

                Math.sin(
                    x *
                    0.08 +
                    soundPhase
                ) *

                amplitude;


            if (
                x === 0
            ) {

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
            alertActive
                ? "rgba(239,68,68,0.95)"
                : "rgba(56,189,248,0.9)";


        ctx.lineWidth =
            alertActive
                ? 3
                : 2;


        ctx.stroke();


        soundPhase +=
            alertActive
                ? 0.16
                : 0.08;


        requestAnimationFrame(
            draw
        );

    }


    draw();

}


/* =========================================================
   SIMULATION
========================================================= */

function toggleSimulation() {

    if (
        simulationRunning
    ) {

        stopSimulation();

    }

    else {

        startSimulation();

    }

}


/* =========================================================
   START SIMULATION
========================================================= */

function startSimulation() {

    if (
        simulationRunning
    ) {
        return;
    }


    simulationRunning =
        true;


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


/* =========================================================
   STOP SIMULATION
========================================================= */

function stopSimulation() {

    simulationRunning =
        false;


    if (
        simulationTimer
    ) {

        clearInterval(
            simulationTimer
        );

        simulationTimer =
            null;

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
        Math.random() *
        8;


    const humidity =
        45 +
        Math.random() *
        30;


    const gas =
        Math.floor(
            150 +
            Math.random() *
            250
        );


    const distance =
        Math.floor(
            20 +
            Math.random() *
            120
        );


    const mic =
        Math.floor(
            100 +
            Math.random() *
            700
        );


    const pir =
        Math.random() <
        0.15
            ? "MOTION"
            : "CLEAR";


    const flame =
        Math.random() <
        0.03
            ? "FIRE"
            : "CLEAR";


    const ldr =
        Math.random() <
        0.08
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

    updateSoundStatus(
        mic
    );


    /* ==========================================
       RANDOM AUDIO EVENT
    ========================================== */

    if (
        Math.random() <
        0.45
    ) {

        const events = [

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
            Math.random() *
            19;


        const signals = {

            animal_hunting:
                "Animal / hunting acoustic signature",

            gunshot_sound:
                "Sudden high-intensity acoustic signature",

            tree_cutting_machine:
                "Mechanical tree-cutting acoustic signature",

            falling_tree:
                "Large impact / falling-tree acoustic signature"

        };


        showAudioEvent(
            event,
            confidence,
            signals[event]
        );


        addToSerialLog(
            "AUDIO:" +
            event +
            ",CONF:" +
            confidence.toFixed(1)
        );

    }

}


/* =========================================================
   TEST FUNCTIONS
========================================================= */

function testAnimal() {

    showAudioEvent(
        "animal_hunting",
        94,
        "Animal / hunting acoustic signature"
    );

}


function testGunshot() {

    showAudioEvent(
        "gunshot_sound",
        92,
        "Sudden high-intensity acoustic signature"
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

        serialLog.innerHTML =
            '<div class="text-slate-500">' +
            "// Logs cleared" +
            "</div>";

    }


    if (alertLog) {

        alertLog.innerHTML =
            '<div class="text-slate-500">' +
            "System ready." +
            "</div>";

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value
    )
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

window.enableDashboardAudio =
    enableDashboardAudio;

window.testAnimal =
    testAnimal;

window.testGunshot =
    testGunshot;

window.testTreeCutting =
    testTreeCutting;

window.testFallingTree =
    testFallingTree;


/* =========================================================
   READY
========================================================= */

console.log(
    "A.E.G.I.S. Audio Alert System READY"
);
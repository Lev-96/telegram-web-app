/**
 * The panel's telemetry reports as the DESKTOP panel (`app: "panel"`); counting
 * browser and Telegram traffic there would make its monitoring lie. The
 * backend has no web client in its telemetry list yet, so this app reports
 * nothing rather than something wrong.
 */
const TelemetryTracker = () => null;

export default TelemetryTracker;

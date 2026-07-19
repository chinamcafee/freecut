type StudioTelemetryProperties = Record<string, string | number | boolean | null | undefined>

export function trackStudioEvent(_event: string, _properties: StudioTelemetryProperties = {}): void {
  // FreeCut owns product telemetry. The upstream Studio mirror keeps this no-op
  // until a FreeCut telemetry adapter is explicitly wired through studio-bridge.
}

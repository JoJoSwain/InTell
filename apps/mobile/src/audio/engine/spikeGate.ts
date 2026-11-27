/**
 * C1: B·S2 tour auto-replay is spike-only. Production ExploringRuntime never
 * sets spikeMode, so this stays false on the phone.
 */
export function shouldRunTourLoop(
  spikeMode: boolean,
  mixActive: boolean,
  hasTourTemplate: boolean,
): boolean {
  return spikeMode && mixActive && hasTourTemplate;
}

/** Powai flagship facilities. Each lab runs a port of the project's own logic, pinned to a commit. */
export const FLAGSHIP_LABS: Record<string, { place: string; setting: string }> = {
  northstar: { place: 'NORTHSTAR Trading Floor', setting: 'Paper-trading risk desk' },
  moneymetrics: { place: 'MoneyMetrics Finance Office', setting: 'Spending anomaly desk' },
  'meeting-intelligence-service': { place: 'Meeting Intelligence Conference Room', setting: 'Transcript to cited action items' },
  rideflow: { place: 'RideFlow Transit Depot', setting: 'Route search and ranking' },
  repolens: { place: 'RepoLens Inspection Office', setting: 'Hybrid code retrieval' },
};

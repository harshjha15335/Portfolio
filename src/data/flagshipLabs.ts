/** Powai flagship facilities. Each lab runs a port of the project's own logic, pinned to a commit. */
export const FLAGSHIP_LABS: Record<string, { place: string; setting: string }> = {
  northstar: { place: 'NORTHSTAR Trading Floor', setting: 'Paper-trading risk desk' },
  moneymetrics: { place: 'MoneyMetrics Finance Office', setting: 'Spending anomaly desk' },
  repolens: { place: 'RepoLens Inspection Office', setting: 'Hybrid code retrieval' },
  compilerlab: { place: 'Compiler Lab Workshop', setting: 'Regex → DFA, direct method' },
};

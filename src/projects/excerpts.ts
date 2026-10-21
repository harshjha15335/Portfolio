/** Verbatim excerpts from the pinned commits linked in src/data/shops.ts (copied, not edited). */
export const EXCERPTS = {
 "python": {
  "file": "ffprime/electrostatics/spherical.py",
  "lines": [
   142,
   163
  ],
  "code": "    theta = np.asarray(theta)\n\n    if theta.shape != (3, 3):\n        raise ValueError(\n            f\"quadrupole tensor must have shape (3, 3), got {theta.shape}\"\n        )\n\n    if not np.allclose(theta, theta.T, atol=1e-10):\n        raise ValueError(\"quadrupole tensor must be symmetric\")\n\n    if not np.isclose(np.trace(theta), 0.0, atol=1e-10):\n        raise ValueError(\n            f\"quadrupole tensor must be traceless, got trace = {np.trace(theta):.6e}\"\n        )\n\n    Q_20 = theta[2, 2]\n    Q_21c = (2.0 / _SQRT3) * theta[0, 2]\n    Q_21s = (2.0 / _SQRT3) * theta[1, 2]\n    Q_22c = (theta[0, 0] - theta[1, 1]) / _SQRT3\n    Q_22s = (2.0 / _SQRT3) * theta[0, 1]\n\n    return np.array([Q_20, Q_21c, Q_21s, Q_22c, Q_22s])"
 },
 "javascript": {
  "file": "js/dashboard.js",
  "lines": [
   169,
   208
  ],
  "code": "function calculateWeeklyAverages(transactions) {\n  const now = new Date();\n  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);\n  \n  const historicalTotals = {};\n  const currentWeekTotals = {};\n  let oldestDate = now;\n\n  transactions.forEach(t => {\n    if (t.type === 'expense') {\n      const tDate = new Date(t.date);\n      if (tDate < oldestDate) oldestDate = tDate;\n      \n      if (tDate >= oneWeekAgo) {\n        currentWeekTotals[t.category] = (currentWeekTotals[t.category] || 0) + t.amount;\n      } else {\n        historicalTotals[t.category] = (historicalTotals[t.category] || 0) + t.amount;\n      }\n    }\n  });\n\n  const millisInWeek = 7 * 24 * 60 * 60 * 1000;\n  const weeksElapsed = Math.max(1, (oneWeekAgo - oldestDate) / millisInWeek);\n  \n  const anomalies = [];\n  const anomalyCategories = new Set();\n  \n  for (const [cat, currentSpent] of Object.entries(currentWeekTotals)) {\n    const histSpent = historicalTotals[cat] || 0;\n    const avgWeekly = histSpent / weeksElapsed;\n    \n    // Anomaly if current week is 40% higher than average and amount is somewhat meaningful\n    if (avgWeekly > 500 && currentSpent > avgWeekly * 1.4) {\n      anomalies.push({ cat, current: currentSpent, avg: avgWeekly });\n      anomalyCategories.add(cat);\n    }\n  }\n\n  return { anomalies, anomalyCategories };\n}"
 }
} as const;

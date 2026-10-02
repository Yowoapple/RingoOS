export function monotonePath(points, { move = true } = {}) {
  const n = points.length;
  if (n === 0) return '';
  const start = `${move ? 'M' : 'L'}${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  if (n < 2) return start;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1][0] - points[i][0] || 0.0001);
    slope.push((points[i + 1][1] - points[i][1]) / dx[i]);
  }
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]));
  }
  tangent.push(slope[n - 2]);
  let d = start;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += ` C${(points[i][0] + h).toFixed(1)} ${(points[i][1] + tangent[i] * h).toFixed(1)} ${(points[i + 1][0] - h).toFixed(1)} ${(points[i + 1][1] - tangent[i + 1] * h).toFixed(1)} ${points[i + 1][0].toFixed(1)} ${points[i + 1][1].toFixed(1)}`;
  }
  return d;
}

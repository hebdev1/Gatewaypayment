type Props = {
  values: number[];
  stroke?: string;
  fill?: string;
  height?: number;
};

export function Sparkline({
  values,
  stroke = "var(--accent)",
  fill = "var(--accent-soft)",
  height = 48
}: Props) {
  if (!values.length) {
    return null;
  }
  const w = 280;
  const h = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - 6 - ((v - min) / range) * (h - 12);
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`))
    .join(" ");
  const areaPath = `${linePath} L${(points.at(-1)![0]).toFixed(2)} ${h} L${points[0][0].toFixed(2)} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function AreaChart({
  values,
  height = 220,
  stroke = "var(--accent)",
  fill = "var(--accent-soft)",
  xLabels = []
}: {
  values: number[];
  height?: number;
  stroke?: string;
  fill?: string;
  xLabels?: string[];
}) {
  if (!values.length) {
    return (
      <div className="empty" style={{ height }}>
        No data yet.
      </div>
    );
  }

  const w = 720;
  const h = height;
  const padding = { left: 36, right: 12, top: 16, bottom: 28 };
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;
  const step = values.length > 1 ? innerW / (values.length - 1) : innerW;

  const points = values.map((v, i) => {
    const x = padding.left + i * step;
    const y = padding.top + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`))
    .join(" ");
  const areaPath = `${linePath} L${(points.at(-1)![0]).toFixed(2)} ${padding.top + innerH} L${points[0][0].toFixed(2)} ${padding.top + innerH} Z`;

  // 4 horizontal gridlines including min and max
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = padding.top + (i / gridSteps) * innerH;
    const v = max - (i / gridSteps) * range;
    return { y, label: Math.round(v).toString() };
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            x2={w - padding.right}
            y1={g.y}
            y2={g.y}
            stroke="rgba(15,23,42,0.06)"
            strokeWidth="1"
          />
          <text
            x={padding.left - 8}
            y={g.y + 3}
            textAnchor="end"
            fontSize="10"
            fill="var(--text-tertiary)"
          >
            {g.label}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--surface)" stroke={stroke} strokeWidth="1.5" />
      ))}

      {xLabels.length
        ? xLabels.map((label, i) => {
            if (i % Math.ceil(xLabels.length / 6) !== 0 && i !== xLabels.length - 1) {
              return null;
            }
            const x = padding.left + i * step;
            return (
              <text
                key={i}
                x={x}
                y={h - 8}
                textAnchor="middle"
                fontSize="10.5"
                fill="var(--text-tertiary)"
              >
                {label}
              </text>
            );
          })
        : null}
    </svg>
  );
}

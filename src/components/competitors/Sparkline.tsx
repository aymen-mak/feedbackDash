interface Props {
  data: number[];
  width?: number;
  height?: number;
  /** Override the direction-based color. */
  color?: string;
  /** Draw a soft gradient area under the line. */
  fill?: boolean;
}

// Tiny dependency-free SVG sparkline. Colors by direction (up = green,
// down = red) unless an explicit color is given. Used per-row in the
// monitoring table and the on-chain board, so it must stay cheap.
export default function Sparkline({ data, width = 84, height = 24, color, fill = false }: Props) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={1}
          y1={height / 2}
          x2={width - 1}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 3"
          className="text-makina-subtle"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const n = data.length;
  const x = (i: number) => (i / (n - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const points = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = data[n - 1] >= data[0];
  const stroke = color ?? (up ? "#22c55e" : "#ef4444");
  const lastX = x(n - 1);
  const lastY = y(data[n - 1]);
  const gid = `sf-${stroke.replace(/[^a-zA-Z0-9]/g, "")}-${width}x${height}-${n}-${Math.round(min)}-${Math.round(max)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon
            points={`${x(0).toFixed(1)},${(height - 0.5).toFixed(1)} ${points} ${lastX.toFixed(1)},${(height - 0.5).toFixed(1)}`}
            fill={`url(#${gid})`}
            stroke="none"
          />
        </>
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.7} fill={stroke} />
    </svg>
  );
}

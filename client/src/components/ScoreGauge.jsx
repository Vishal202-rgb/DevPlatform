function scoreDetails(score) {
  if (score >= 85) return { color: '#10B981', label: 'Optimal', grade: 'A+' };
  if (score >= 70) return { color: '#34D399', label: 'Good', grade: 'A' };
  if (score >= 50) return { color: '#F59E0B', label: 'Moderate', grade: 'B' };
  if (score >= 30) return { color: '#F97316', label: 'Needs Attention', grade: 'C' };
  return { color: '#EF4444', label: 'Critical Debt', grade: 'D' };
}

export default function ScoreGauge({ score, size = 136 }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const filled = (clamped / 100) * circumference;
  const { color, label, grade } = scoreDetails(clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-20 transition-all pointer-events-none"
          style={{ backgroundColor: color }}
        />

        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1D2232"
            strokeWidth="8"
          />
          {/* Animated fill circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-700 ease-out"
          />
          {/* Score text */}
          <text
            x="50%"
            y="46%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="font-mono"
            fill="#F8FAFC"
            fontSize={size * 0.28}
            fontWeight="700"
          >
            {clamped}
          </text>
          <text
            x="50%"
            y="65%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="font-mono"
            fill="#64748B"
            fontSize={size * 0.1}
            fontWeight="600"
          >
            / 100
          </text>
        </svg>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-mono text-xs font-semibold text-mist-200">
          {grade} · {label}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-mist-500">
        Code Health Score
      </p>
    </div>
  );
}
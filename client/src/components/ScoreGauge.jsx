function scoreColor(score) {
  if (score >= 80) return '#7FB069'; // green
  if (score >= 50) return '#F5B942'; // amber
  return '#D46A6A'; // red
}

export default function ScoreGauge({ score, size = 128 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#232A3B"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="font-mono"
          fill="#F4F6FA"
          fontSize={size * 0.26}
          fontWeight="700"
        >
          {score}
        </text>
      </svg>
      <p className="mt-2 text-xs uppercase tracking-wider text-mist-500">Code health score</p>
    </div>
  );
}

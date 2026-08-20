// import { useMemo, useState } from 'react';
// import { severityConfig } from './SeveritySummary';

// const categoryLabels = {
//   bug: 'Bug',
//   security: 'Security',
//   performance: 'Performance',
//   'code-smell': 'Code smell',
// };

// const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

// function IssueRow({ issue }) {
//   const [expanded, setExpanded] = useState(false);
//   const cfg = severityConfig[issue.severity] || severityConfig.low;

//   return (
//     <div className="rounded-lg border border-graphite-700 bg-graphite-900">
//       <div
//         role="button"
//         tabIndex={0}
//         onClick={() => setExpanded((e) => !e)}
//         onKeyDown={(e) => {
//           if (e.key === 'Enter' || e.key === ' ') setExpanded((exp) => !exp);
//         }}
//         className="flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-3 text-left"
//       >
//         <div className="min-w-0 flex-1">
//           <div className="flex flex-wrap items-center gap-2">
//             <span
//               className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
//             >
//               {cfg.label}
//             </span>
//             <span className="rounded-full bg-graphite-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-mist-300">
//               {categoryLabels[issue.category] || issue.category}
//             </span>
//             <span className="truncate font-mono text-xs text-mist-500">
//               {issue.file}
//               {issue.line ? `:${issue.line}` : ''}
//             </span>
//             {issue.repository && (
//               <a
//                 href={issue.repository.htmlUrl}
//                 target="_blank"
//                 rel="noreferrer"
//                 onClick={(e) => e.stopPropagation()}
//                 className="truncate rounded-full bg-graphite-700 px-2 py-0.5 text-[10px] text-amber-400 hover:underline"
//               >
//                 {issue.repository.fullName}
//               </a>
//             )}
//           </div>
//           <p className="mt-1.5 text-sm text-mist-100">{issue.description}</p>
//         </div>
//         <span className="mt-1 shrink-0 text-mist-500">{expanded ? '−' : '+'}</span>
//       </div>

//       {expanded && (
//         <div className="border-t border-graphite-700 px-4 py-3 text-sm">
//           <div>
//             <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
//               Recommendation
//             </p>
//             <p className="mt-1 text-mist-300">{issue.recommendation}</p>
//           </div>
//           {issue.suggestedFix && (
//             <div className="mt-3">
//               <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
//                 Suggested fix
//               </p>
//               <pre className="mt-1 overflow-x-auto rounded-lg bg-graphite-950 p-3 font-mono text-xs text-amber-400">
//                 {issue.suggestedFix}
//               </pre>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// export default function IssueList({ issues }) {
//   const [filter, setFilter] = useState('all');

//   const filtered = useMemo(() => {
//     const sorted = [...issues].sort(
//       (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
//     );
//     if (filter === 'all') return sorted;
//     return sorted.filter((i) => i.severity === filter);
//   }, [issues, filter]);

//   if (issues.length === 0) {
//     return (
//       <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-8 text-center">
//         <p className="text-sm text-mist-500">No issues found — clean run.</p>
//       </div>
//     );
//   }

//   return (
//     <div>
//       <div className="mb-3 flex flex-wrap gap-2">
//         {['all', 'critical', 'high', 'medium', 'low'].map((key) => (
//           <button
//             key={key}
//             onClick={() => setFilter(key)}
//             className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
//               filter === key
//                 ? 'bg-amber-400 text-graphite-950'
//                 : 'bg-graphite-800 text-mist-300 hover:bg-graphite-700'
//             }`}
//           >
//             {key}
//           </button>
//         ))}
//       </div>
//       <div className="flex flex-col gap-2">
//         {filtered.map((issue, idx) => (
//           <IssueRow key={issue._id || idx} issue={issue} />
//         ))}
//       </div>
//     </div>
//   );
// }

import { useMemo, useState } from 'react';
import { severityConfig } from './SeveritySummary';
import { applyIssueFix } from '../services/analysisService';

const categoryLabels = {
  bug: 'Bug',
  security: 'Security',
  performance: 'Performance',
  'code-smell': 'Code smell',
};

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

function IssueRow({ issue, analysisId }) {
  const [expanded, setExpanded] = useState(false);
  const [issueState, setIssueState] = useState(issue);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const cfg = severityConfig[issueState.severity] || severityConfig.low;
  const effectiveAnalysisId = issueState.analysisId || analysisId;

  const handleApplyFix = async (e) => {
    e.stopPropagation();
    if (!effectiveAnalysisId || !issueState._id || isApplying) return;
    setIsApplying(true);
    setApplyError('');
    try {
      const result = await applyIssueFix(effectiveAnalysisId, issueState._id);
      setIssueState((prev) => ({ ...prev, ...result.issue }));
    } catch (err) {
      setApplyError(err.message || 'Failed to apply fix.');
      setIssueState((prev) => ({ ...prev, fixStatus: 'failed' }));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="rounded-lg border border-graphite-700 bg-graphite-900">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded((exp) => !exp);
        }}
        className="flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
            >
              {cfg.label}
            </span>
            <span className="rounded-full bg-graphite-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-mist-300">
              {categoryLabels[issueState.category] || issueState.category}
            </span>
            <span className="truncate font-mono text-xs text-mist-500">
              {issueState.file}
              {issueState.line ? `:${issueState.line}` : ''}
            </span>
            {issueState.repository && (
              <a
                href={issueState.repository.htmlUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="truncate rounded-full bg-graphite-700 px-2 py-0.5 text-[10px] text-amber-400 hover:underline"
              >
                {issueState.repository.fullName}
              </a>
            )}
            {issueState.fixStatus === 'applied' && (
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                Fix applied
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-mist-100">{issueState.description}</p>
        </div>
        <span className="mt-1 shrink-0 text-mist-500">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div className="border-t border-graphite-700 px-4 py-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
              Recommendation
            </p>
            <p className="mt-1 text-mist-300">{issueState.recommendation}</p>
          </div>

          {issueState.suggestedFix && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
                Suggested fix
              </p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-graphite-950 p-3 font-mono text-xs text-amber-400">
                {issueState.suggestedFix}
              </pre>
              <p className="mt-1.5 text-xs text-mist-500">
                This is a hint, not a full-file replacement — "Apply Fix" below has Gemini
                rewrite the complete file for you instead.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-graphite-800 pt-3">
            {issueState.fixStatus === 'applied' && issueState.fixCompareUrl ? (
              <a
                href={issueState.fixCompareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/20"
              >
                View fix branch &amp; open PR →
              </a>
            ) : (
              <button
                onClick={handleApplyFix}
                disabled={isApplying}
                className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying ? 'Applying fix…' : 'Apply Fix'}
              </button>
            )}
            {issueState.fixBranch && issueState.fixStatus === 'applied' && (
              <span className="font-mono text-[11px] text-mist-500">{issueState.fixBranch}</span>
            )}
          </div>
          {applyError && <p className="mt-2 text-xs text-red-400">{applyError}</p>}
        </div>
      )}
    </div>
  );
}

export default function IssueList({ issues, analysisId }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const sorted = [...issues].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
    if (filter === 'all') return sorted;
    return sorted.filter((i) => i.severity === filter);
  }, [issues, filter]);

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-8 text-center">
        <p className="text-sm text-mist-500">No issues found — clean run.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {['all', 'critical', 'high', 'medium', 'low'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === key
                ? 'bg-amber-400 text-graphite-950'
                : 'bg-graphite-800 text-mist-300 hover:bg-graphite-700'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {filtered.map((issue, idx) => (
          <IssueRow key={issue._id || idx} issue={issue} analysisId={analysisId} />
        ))}
      </div>
    </div>
  );
}


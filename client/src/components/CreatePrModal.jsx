import { useState, useEffect } from 'react';
import { generateIssuePr, createIssuePr } from '../services/analysisService';

export default function CreatePrModal({
  isOpen,
  onClose,
  analysisId,
  issue,
  branchType = 'fix',
  onPrCreated,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [headBranch, setHeadBranch] = useState('');
  const [filesChanged, setFilesChanged] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [isFallbackNotice, setIsFallbackNotice] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdPr, setCreatedPr] = useState(null);

  const targetBranch =
    branchType === 'test'
      ? issue?.testBranch || issue?.fixBranch
      : issue?.fixBranch || issue?.testBranch;

  const loadPrDraft = async () => {
    if (!analysisId || !issue?._id) return;
    setIsGenerating(true);
    setGenerateError('');
    setSubmitError('');
    setIsFallbackNotice(false);

    try {
      const data = await generateIssuePr(analysisId, issue._id, {
        branchType,
        branchName: targetBranch,
      });

      setTitle(data.title || '');
      setDescription(data.description || '');
      setBaseBranch(data.baseBranch || 'main');
      setHeadBranch(data.headBranch || targetBranch);
      setFilesChanged(data.filesChanged || []);
      if (data.isFallback) {
        setIsFallbackNotice(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate PR details.';
      setGenerateError(msg);
      // Pre-fill editable fallback so user can still manually create PR if diff exists
      if (!title) {
        setTitle(
          branchType === 'test'
            ? `Test: Add tests for ${issue.file || 'component'}`
            : `Fix: ${issue.description ? issue.description.slice(0, 60) : 'issue'}`
        );
      }
      if (!description) {
        setDescription(
          `## Summary\nApply changes for ${issue.file || 'repository'}.\n\n## Changes\n- Updated affected files.\n\n## Why\n${issue.description || 'Address identified issue.'}\n\n## Testing\n- Automated validation.\n\n## Files Changed\n- \`${issue.file || 'affected file'}\``
        );
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && issue) {
      setCreatedPr(null);
      loadPrDraft();
    } else {
      setTitle('');
      setDescription('');
      setFilesChanged([]);
      setGenerateError('');
      setSubmitError('');
      setCreatedPr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, issue?._id, branchType]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setSubmitError('Please enter a PR title.');
      return;
    }
    if (!headBranch) {
      setSubmitError('Branch name is missing.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await createIssuePr(analysisId, issue._id, {
        title: title.trim(),
        description: description.trim(),
        headBranch,
        baseBranch,
      });

      setCreatedPr(result.pr);
      if (onPrCreated) {
        onPrCreated(result.pr, result.issue);
      }
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || err.message || 'Failed to create pull request on GitHub.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-xl border border-graphite-700 bg-graphite-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-graphite-700 px-6 py-4 bg-graphite-900">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 font-mono text-sm font-bold">
              PR
            </div>
            <div>
              <h2 className="text-base font-semibold text-mist-100">
                {branchType === 'test' ? 'Create Pull Request for Tests' : 'Create Pull Request for Fix'}
              </h2>
              <p className="text-xs text-mist-400 font-mono">
                {baseBranch || 'base'} &larr; <span className="text-amber-400">{headBranch || targetBranch}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-mist-400 transition-colors hover:bg-graphite-800 hover:text-mist-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {createdPr ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-2xl">
                ✓
              </div>
              <h3 className="text-lg font-semibold text-mist-100">
                Pull Request #{createdPr.number} Created!
              </h3>
              <p className="text-sm text-mist-300">
                Your pull request has been opened on GitHub and linked to this issue.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={createdPr.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-emerald-500"
                >
                  View on GitHub ↗
                </a>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-graphite-600 px-4 py-2 text-sm text-mist-200 transition-colors hover:bg-graphite-800"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Diff summary pills */}
              {filesChanged.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-mist-500 font-medium mr-1">Diff changes:</span>
                  {filesChanged.map((file) => (
                    <span
                      key={file.filename}
                      className="rounded bg-graphite-800 border border-graphite-700 px-2 py-0.5 font-mono text-[11px] text-mist-300"
                    >
                      {file.filename}
                      {file.additions !== undefined && (
                        <span className="ml-1 text-emerald-400">+{file.additions}</span>
                      )}
                      {file.deletions !== undefined && (
                        <span className="ml-0.5 text-red-400">-{file.deletions}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Gemini Fallback Alert */}
              {isFallbackNotice && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300">
                  <span className="font-semibold">Notice:</span> Gemini model was temporarily busy. Pre-populated a structured PR template from repository changes so you can review, edit, and proceed without delay.
                </div>
              )}

              {/* Generation Error */}
              {generateError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  <span className="font-semibold">Error:</span> {generateError}
                </div>
              )}

              {/* Submission Error */}
              {submitError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  <span className="font-semibold">GitHub Error:</span> {submitError}
                </div>
              )}

              <form id="create-pr-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pr-title" className="block text-xs font-semibold uppercase tracking-wide text-mist-400">
                      PR Title
                    </label>
                    <span className="text-[11px] text-mist-500">Concise &amp; descriptive</span>
                  </div>
                  <input
                    id="pr-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isGenerating || isSubmitting}
                    placeholder="e.g. Fix: Resolve SQL injection vulnerability in auth query"
                    className="w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3 py-2 text-sm text-mist-100 placeholder-mist-600 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="pr-description" className="block text-xs font-semibold uppercase tracking-wide text-mist-400">
                      PR Description (Markdown)
                    </label>
                    <span className="text-[11px] text-mist-500">Structured: Summary, Changes, Why, Testing, Files</span>
                  </div>
                  <textarea
                    id="pr-description"
                    rows={12}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isGenerating || isSubmitting}
                    placeholder="## Summary&#10;...&#10;&#10;## Changes&#10;- ...&#10;&#10;## Why&#10;...&#10;&#10;## Testing&#10;- ...&#10;&#10;## Files Changed&#10;- ..."
                    className="w-full rounded-lg border border-graphite-700 bg-graphite-950 p-3 font-mono text-xs text-mist-200 placeholder-mist-600 focus:border-amber-400 focus:outline-none disabled:opacity-50 resize-y"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!createdPr && (
          <div className="flex items-center justify-between border-t border-graphite-700 px-6 py-3.5 bg-graphite-900">
            <button
              type="button"
              onClick={loadPrDraft}
              disabled={isGenerating || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-700 px-3 py-1.5 text-xs font-semibold text-mist-300 transition-colors hover:border-amber-400/60 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              title="Regenerate PR title and description using AI"
            >
              <span className={isGenerating ? 'animate-spin' : ''}>⟳</span>
              {isGenerating ? 'Generating…' : 'Regenerate'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-graphite-700 px-3.5 py-1.5 text-xs font-medium text-mist-400 transition-colors hover:bg-graphite-800 hover:text-mist-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-pr-form"
                disabled={isSubmitting || isGenerating || !title.trim()}
                className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
              >
                {isSubmitting ? 'Creating PR on GitHub…' : 'Create Pull Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

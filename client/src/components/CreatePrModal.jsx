import { useState, useEffect } from 'react';
import { generateIssuePr, createIssuePr } from '../services/analysisService';
import MarkdownRenderer from './MarkdownRenderer';

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
  const [baseBranch, setBaseBranch] = useState('main');
  const [headBranch, setHeadBranch] = useState('');
  const [filesChanged, setFilesChanged] = useState([]);
  const [previewTab, setPreviewTab] = useState('edit'); // 'edit' | 'preview'

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
      // Pre-fill editable fallback
      if (!title) {
        setTitle(
          branchType === 'test'
            ? `test: add automated unit tests for ${issue.file || 'module'}`
            : `fix: resolve ${issue.category || 'issue'} in ${issue.file || 'module'}`
        );
      }
      if (!description) {
        setDescription(
          `## Summary\nAutomated fix proposed by DevPlatform AI for ${issue.file || 'repository'}.\n\n## Changes\n- Applied remediation for identified ${issue.category || 'issue'}.\n\n## Why\n${issue.description || 'Address code review finding.'}\n\n## Testing\n- Validated regression test pass.`
        );
      }
      if (targetBranch) {
        setHeadBranch(targetBranch);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && issue) {
      setCreatedPr(null);
      setPreviewTab('edit');
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

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setSubmitError('Please provide a title for the pull request.');
      return;
    }
    if (!headBranch) {
      setSubmitError('Head branch name is missing.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-graphite-700 bg-graphite-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graphite-700/80 px-6 py-4 bg-graphite-850">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-mono text-sm font-bold">
              PR
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-mist-100">
                {branchType === 'test' ? 'Create Test Pull Request' : 'Create Fix Pull Request'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-mist-400 font-mono mt-0.5">
                <span className="text-mist-300 font-semibold">{baseBranch || 'main'}</span>
                <span>←</span>
                <span className="rounded bg-graphite-800 px-1.5 py-0.2 text-amber-400 border border-graphite-700">
                  {headBranch || targetBranch || 'fix-branch'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-mist-400 hover:bg-graphite-800 hover:text-mist-100 transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {createdPr ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4 animate-scale-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 text-3xl shadow-sm">
                ✓
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-mist-100">
                  Pull Request #{createdPr.number} Opened!
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-mist-300 max-w-md mx-auto">
                  Your changes have been pushed to GitHub with linked review context and descriptions.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a
                  href={createdPr.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-emerald-500 shadow-sm"
                >
                  View on GitHub ↗
                </a>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-graphite-600 bg-graphite-800 px-4 py-2 text-xs font-medium text-mist-200 hover:bg-graphite-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Files changed diff pills */}
              {filesChanged.length > 0 && (
                <div className="rounded-xl border border-graphite-800 bg-graphite-950/70 p-3 space-y-1.5">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-mist-500 block">
                    Changed Files ({filesChanged.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {filesChanged.map((file) => (
                      <span
                        key={file.filename}
                        className="inline-flex items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-850 px-2 py-1 font-mono text-[11px] text-mist-300"
                      >
                        <span className="truncate max-w-[200px]">{file.filename}</span>
                        {file.additions !== undefined && (
                          <span className="text-emerald-400 font-semibold">+{file.additions}</span>
                        )}
                        {file.deletions !== undefined && (
                          <span className="text-red-400 font-semibold">-{file.deletions}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback Notice */}
              {isFallbackNotice && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <span className="font-semibold">Notice:</span> Pre-populated structured PR template from repository AST changes. You can customize the fields before creating the pull request.
                </div>
              )}

              {/* Errors */}
              {generateError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <span className="font-semibold">Generation Notice:</span> {generateError}
                </div>
              )}

              {submitError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 font-mono">
                  <span className="font-semibold">GitHub Error:</span> {submitError}
                </div>
              )}

              {/* PR Form */}
              <form id="create-pr-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="pr-title" className="block text-xs font-mono font-semibold uppercase tracking-wider text-mist-400 mb-1.5">
                    Pull Request Title
                  </label>
                  <input
                    id="pr-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isGenerating || isSubmitting}
                    placeholder="e.g. fix: resolve SQL parameter injection vulnerability"
                    className="w-full rounded-xl border border-graphite-700 bg-graphite-950 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-600 focus:border-amber-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="pr-desc" className="block text-xs font-mono font-semibold uppercase tracking-wider text-mist-400">
                      Description (Markdown)
                    </label>

                    {/* Edit vs Preview Toggle */}
                    <div className="flex items-center gap-1 rounded-md border border-graphite-700 bg-graphite-800 p-0.5 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('edit')}
                        className={`rounded px-2 py-0.5 transition-colors ${
                          previewTab === 'edit'
                            ? 'bg-amber-400 text-graphite-950 font-bold'
                            : 'text-mist-400 hover:text-mist-200'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTab('preview')}
                        className={`rounded px-2 py-0.5 transition-colors ${
                          previewTab === 'preview'
                            ? 'bg-amber-400 text-graphite-950 font-bold'
                            : 'text-mist-400 hover:text-mist-200'
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {previewTab === 'edit' ? (
                    <textarea
                      id="pr-desc"
                      rows={10}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={isGenerating || isSubmitting}
                      className="w-full rounded-xl border border-graphite-700 bg-graphite-950 p-3 font-mono text-xs text-mist-200 outline-none transition-colors placeholder:text-mist-600 focus:border-amber-400 disabled:opacity-50 resize-y leading-relaxed"
                    />
                  ) : (
                    <div className="rounded-xl border border-graphite-700 bg-graphite-950 p-4 max-h-72 overflow-y-auto">
                      <MarkdownRenderer content={description || '_No description provided._'} />
                    </div>
                  )}
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        {!createdPr && (
          <div className="flex items-center justify-between border-t border-graphite-700/80 px-6 py-4 bg-graphite-850">
            <button
              type="button"
              onClick={loadPrDraft}
              disabled={isGenerating || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-semibold text-mist-300 transition-colors hover:border-amber-400/50 hover:text-amber-400 disabled:opacity-50"
            >
              <span className={isGenerating ? 'animate-spin' : ''}>⟳</span>
              <span>{isGenerating ? 'Drafting with Gemini…' : 'Regenerate Draft'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-graphite-700 px-3.5 py-1.5 text-xs font-medium text-mist-400 hover:bg-graphite-800 hover:text-mist-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-pr-form"
                disabled={isSubmitting || isGenerating || !title.trim()}
                className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? 'Opening Pull Request…' : 'Open Pull Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

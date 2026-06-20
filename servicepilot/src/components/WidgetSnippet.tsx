"use client";

import { useEffect, useState } from "react";

export function WidgetSnippet({
  businessId,
  businessName,
  active,
  fallbackOrigin,
}: {
  businessId: string;
  businessName: string;
  active: boolean;
  fallbackOrigin: string;
}) {
  const [origin, setOrigin] = useState(fallbackOrigin);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const base = origin || fallbackOrigin || "https://your-domain.com";
  const snippet =
    '<script src="' +
    base +
    '/widget.js" data-business-id="' +
    businessId +
    '" async></script>';
  const previewUrl = base + "/embed/" + businessId;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {!active && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This business is not active yet, so the widget will not load on
          external sites until the account is activated.
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Embed code for {businessName}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Paste this snippet just before the closing &lt;/body&gt; tag on every
          page where you want the chat bubble to appear.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4">
          <code className="block whitespace-pre text-xs text-slate-100">
            {snippet}
          </code>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={copy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Preview chat
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">How it works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Copy the embed code above.</li>
          <li>
            Paste it into your website&apos;s HTML, right before &lt;/body&gt;.
          </li>
          <li>
            A chat bubble appears in the bottom-right corner for your visitors.
          </li>
          <li>
            The assistant answers questions and books jobs straight into your
            dashboard.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-400">
          Works on any platform that lets you add custom HTML (WordPress, Wix,
          Squarespace, Webflow, custom sites, and more).
        </p>
      </section>
    </div>
  );
}

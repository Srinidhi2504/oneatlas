"use client";
// Button that copies a link and confirms in place (announced to screen readers).
import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "./primitives";

/** Copies the current URL (or `href`) and confirms in place; the confirmation is announced to screen readers. */
export function CopyLinkButton({ label = "Copy link", href }: { label?: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const url = href ? new URL(href, window.location.origin).toString() : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url); // clipboard blocked (insecure context / permissions)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button type="button" onClick={copy} className={buttonClass("secondary", "md")}>
      {copied ? <Check className="text-success" aria-hidden /> : <Link2 aria-hidden />}
      <span aria-live="polite">{copied ? "Link copied" : label}</span>
    </button>
  );
}

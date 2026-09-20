/**
 * A real link styled as a button — a <button> nested inside an <a> is invalid
 * HTML and reads as two controls to screen readers.
 */
export function ExportButton() {
  return (
    <a
      href="/export"
      download
      className="h-10 px-4 inline-flex items-center rounded-control bg-surface-raised text-[14px] font-medium text-text-primary pressable"
    >
      Download CSV zip
    </a>
  );
}

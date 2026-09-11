/** The established Hive identity is retained without altering its geometry or colors. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 270 269" className={className} aria-hidden="true">
      <image href="/images/hive-icon.svg" width="270" height="269" />
    </svg>
  );
}

export function StaticSculpture() {
  return (
    <svg viewBox="0 0 520 460" aria-hidden="true">
      <image href="/images/hive-icon.svg" x="95" y="65" width="330" height="329" />
    </svg>
  );
}

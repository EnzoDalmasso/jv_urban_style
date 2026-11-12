type WordmarkProps = {
  showName?: boolean;
};

export function Wordmark({ showName = true }: WordmarkProps) {
  return (
    <span className="wordmark">
      <span className="wordmark-mark" aria-hidden="true">JV</span>
      {showName && (
        <span className="wordmark-name">
          Urban Style
          <small>Barbería</small>
        </span>
      )}
    </span>
  );
}

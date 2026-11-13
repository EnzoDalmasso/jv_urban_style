import logoMark from '../assets/brand/logo-mark.webp';

export function Wordmark() {
  return (
    <span className="wordmark">
      <img className="wordmark-mark" src={logoMark} alt="" width={186} height={160} />
      <span className="wordmark-name">
        Urban Style
        <small>Barbería</small>
      </span>
    </span>
  );
}

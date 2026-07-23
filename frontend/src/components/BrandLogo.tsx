type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? 'brand-logo compact' : 'brand-logo'} aria-label="JV Urban Style Barbería">
      <span className="brand-crown">♕</span>
      <strong>JV</strong>
      <span>Urban Style</span>
      <small>Barbería</small>
    </div>
  );
}

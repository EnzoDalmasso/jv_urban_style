import logoFull from '../assets/brand/logo-full.webp';

type BrandLogoProps = {
  className?: string;
};

// Logo completo (emblema + "Urban Style Barber 2007"), para footer y login.
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      className={['brand-logo', className].filter(Boolean).join(' ')}
      src={logoFull}
      alt="JV Urban Style Barber, desde 2007"
      width={640}
      height={515}
    />
  );
}

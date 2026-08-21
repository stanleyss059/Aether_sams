type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className = "h-9 w-9", alt = "Aether" }: BrandLogoProps) {
  return <img src="/logo.png" alt={alt} className={`object-contain ${className}`} />;
}

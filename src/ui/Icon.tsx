import { icons, type LucideProps } from 'lucide-react';

const toPascal = (s: string) => s.replace(/(^|[-_ ])(\w)/g, (_, __, c: string) => c.toUpperCase());

/** Resolves icon names coming from plugin manifests ("heart-pulse") to lucide components. Unknown → Box. */
export function Icon({ name, size = 16, ...rest }: { name: string } & LucideProps) {
  const C = (icons as Record<string, React.ComponentType<LucideProps>>)[toPascal(name)] ?? icons.Box;
  return <C size={size} strokeWidth={1.6} {...rest} />;
}
export const hasIcon = (name: string) => toPascal(name) in icons;

import { ELEMENT_ICON_MAP } from '@/types/game';

interface ElementIconProps {
  element: string;
  size?: number;
}

export default function ElementIcon({ element, size = 20 }: ElementIconProps) {
  const iconPath = ELEMENT_ICON_MAP[element];
  if (!iconPath) {
    return <span className="text-muted-foreground text-xs">{element || '-'}</span>;
  }
  return (
    <img
      src={iconPath}
      alt={element}
      title={element}
      width={size}
      height={size}
      className="inline-block"
    />
  );
}

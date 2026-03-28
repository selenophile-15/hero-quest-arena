/**
 * Type image path utility - switches between dark/light mode type icons.
 * Dark mode: /images/type_dark/ (white icons for dark backgrounds)
 * Light mode: /images/type_white/ (dark icons for light backgrounds)
 */

const TYPE_FILE_FIX: Record<string, Record<string, string>> = {
  type_white: { aurasong: 'aruasong' }, // handle filename typo
};

const TYPE_NAME_FIX: Record<string, string> = { staves: 'staff' };

export function getTypeImagePath(typeFile: string, colorMode: 'dark' | 'light' = 'dark'): string {
  const normalizedType = TYPE_NAME_FIX[typeFile] || typeFile;
  const folder = colorMode === 'light' ? 'type_white' : 'type_dark';
  const fixMap = TYPE_FILE_FIX[folder];
  const fixedFile = fixMap?.[normalizedType] || normalizedType;
  return `/images/${folder}/${fixedFile}.webp`;
}

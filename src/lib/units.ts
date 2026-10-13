/**
 * Nom de l'unité suivante, pour le bouton « Dupliquer » :
 * "Chambre 3" -> "Chambre 4", "A1" -> "A2", "B09" -> "B10", "Studio" -> "Studio 2".
 */
export function nextUnitLabel(label: string): string {
  const m = label.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return label.trim() ? `${label.trim()} 2` : '';
  const [, head, digits, tail] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${head}${next}${tail}`;
}

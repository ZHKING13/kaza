import Svg, { Path, Rect } from 'react-native-svg';

import type { Country } from '@/data/countries';

const STAR = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
};

/** Drapeaux des pays pris en charge, dessinés en SVG (les drapeaux emoji ne s'affichent pas partout). */
export function Flag({ code, size = 24 }: { code: Country['code']; size?: number }) {
  const w = size;
  const h = (size * 2) / 3;
  const v = (colors: string[]) =>
    colors.map((c, i) => <Rect key={i} x={(i * 30) / colors.length} y={0} width={30 / colors.length} height={20} fill={c} />);
  const hz = (colors: string[]) =>
    colors.map((c, i) => <Rect key={i} x={0} y={(i * 20) / colors.length} width={30} height={20 / colors.length} fill={c} />);

  let body: React.ReactNode;
  switch (code) {
    case 'CI':
      body = v(['#F77F00', '#FFFFFF', '#009E60']);
      break;
    case 'ML':
      body = v(['#14B53A', '#FCD116', '#CE1126']);
      break;
    case 'SN':
      body = (
        <>
          {v(['#00853F', '#FDEF42', '#E31B23'])}
          <Path d={STAR(15, 10, 3.2)} fill="#00853F" />
        </>
      );
      break;
    case 'CM':
      body = (
        <>
          {v(['#007A5E', '#CE1126', '#FCD116'])}
          <Path d={STAR(15, 10, 3.2)} fill="#FCD116" />
        </>
      );
      break;
    case 'BJ':
      body = (
        <>
          <Rect x={0} y={0} width={12} height={20} fill="#008751" />
          <Rect x={12} y={0} width={18} height={10} fill="#FCD116" />
          <Rect x={12} y={10} width={18} height={10} fill="#E8112D" />
        </>
      );
      break;
    case 'TG':
      body = (
        <>
          {hz(['#006A4E', '#FFCE00', '#006A4E', '#FFCE00', '#006A4E'])}
          <Rect x={0} y={0} width={12} height={12} fill="#D21034" />
          <Path d={STAR(6, 6, 3.4)} fill="#FFFFFF" />
        </>
      );
      break;
    case 'BF':
      body = (
        <>
          {hz(['#EF2B2D', '#009E49'])}
          <Path d={STAR(15, 10, 3.2)} fill="#FCD116" />
        </>
      );
      break;
  }
  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 30 20"
      style={{ borderRadius: 2 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {body}
      <Rect x={0.25} y={0.25} width={29.5} height={19.5} fill="none" stroke="#0F172A" strokeOpacity={0.15} strokeWidth={0.5} />
    </Svg>
  );
}

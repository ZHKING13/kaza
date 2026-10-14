import { Platform } from 'react-native';

/** Supprime le contour du navigateur sur les champs : la bordure du champ indique déjà le focus. */
export const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;

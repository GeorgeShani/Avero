export const themeStorageKey = 'avero-theme';

/**
 * Runs before the page paints, so a dark page never flashes light. It ships inline in the
 * document head, which is why it is a string. Keep it in step with `resolveTheme` in theme.ts.
 */
export const themeBootScript = `(function(){try{var m=localStorage.getItem('${themeStorageKey}');var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;

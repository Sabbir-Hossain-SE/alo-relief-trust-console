import { NAV_COLLAPSED_ATTRIBUTE, PREFERENCES_STORAGE_KEY } from '@/store/preferences';

/**
 * The script that marks the document as nav-collapsed before the first paint.
 *
 * Built from the same constants the store uses, so the key and the attribute
 * cannot drift. It reads the stored preferences on its own rather than through
 * the parser, because it has to run before any module has loaded.
 */
export function navCollapsedScript(): string {
  const key = JSON.stringify(PREFERENCES_STORAGE_KEY);
  const attribute = JSON.stringify(NAV_COLLAPSED_ATTRIBUTE);

  return (
    '(function(){try{' +
    `var p=JSON.parse(localStorage.getItem(${key}));` +
    `if(p&&p.navCollapsed===true)document.documentElement.setAttribute(${attribute},'');` +
    '}catch(e){}})()'
  );
}

/**
 * Applies the stored nav preference before the server-rendered page paints.
 *
 * The server cannot see local storage, so it renders the rail expanded. Left
 * to React, the collapsed width arrived two renders after hydration and the
 * rail was drawn wide and then animated shut on every load. This runs where
 * MUI's colour-scheme script does, at the top of the body, so the first paint
 * already has the right width.
 */
export function InitNavScript() {
  return <script dangerouslySetInnerHTML={{ __html: navCollapsedScript() }} />;
}

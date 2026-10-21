import React from 'react';
import { AppView, VIEW_PATHS, useNavigationActions } from '../../context/NavigationContext';

/** Keep native link behavior (copy address, new tab, modifier clicks) alongside SPA navigation. */
export function AppLink({ view, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { view: AppView }) {
  const { setCurrentView } = useNavigationActions();
  return <a {...props} href={`#${VIEW_PATHS[view]}`} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setCurrentView(view);
  }} />;
}

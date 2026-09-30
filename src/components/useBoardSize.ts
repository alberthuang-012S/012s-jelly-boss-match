import { useLayoutEffect, type RefObject } from 'react';

/** Fit the board to the actual HUD height, including optional boss warnings. */
export function useBoardSize(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const shell = ref.current;
    if (!active || !shell) return;
    const section = shell.querySelector<HTMLElement>('.board-section');
    if (!section) return;
    const fixed = Array.from(shell.children).filter((child) =>
      child.matches('.battle-topbar, .battlefield, .stats-panel, .battle-footer')) as HTMLElement[];
    let frame = 0;
    const fit = () => {
      const style = getComputedStyle(shell);
      const sectionStyle = getComputedStyle(section);
      const gap = parseFloat(style.rowGap) || 0;
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const occupied = fixed.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0)
        + padding + gap * fixed.length
        + parseFloat(sectionStyle.paddingTop);
      const topMargin = parseFloat(style.marginTop) || 0;
      const room = window.innerHeight - topMargin - occupied - 12;
      // Below this minimum, scroll instead of shrinking touch targets indefinitely.
      const width = Math.floor(Math.min(section.clientWidth, 425, Math.max(280, room)));
      const value = `${width}px`;
      if (shell.style.getPropertyValue('--board-size') !== value) shell.style.setProperty('--board-size', value);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const resize = new ResizeObserver(schedule);
    [section, ...fixed].forEach((element) => resize.observe(element));
    window.addEventListener('resize', schedule);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [ref, active]);
}

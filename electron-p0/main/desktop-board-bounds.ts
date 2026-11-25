type WorkArea = Readonly<{ x: number; y: number; width: number; height: number }>;

const singleDisplayIconSpace = 0.22;

export function desktopBoardBounds(workArea: WorkArea, displayCount: number, iconSpace = singleDisplayIconSpace * 100): WorkArea {
  if (displayCount !== 1) return workArea;

  const inset = Math.round(workArea.width * iconSpace / 100);
  return { ...workArea, x: workArea.x + inset, width: workArea.width - inset };
}

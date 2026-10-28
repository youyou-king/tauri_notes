export type PackItem = {
  id: string;
  span: number;
  height: number;
};

export type PackedCard = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  span: number;
};

export type PackOptions = {
  gap?: number;
  minColumnWidth?: number;
  maxColumns?: number;
};

export type PackResult = {
  cards: PackedCard[];
  width: number;
  height: number;
  columnWidth: number;
  columnCount: number;
};

/**
 * 列式打包：
 * - span 是语义宽度（占几列），不是像素；
 * - 顺序固定，放入当前高度最低的可用列；
 * - 不产生重叠，删除后自动补位；
 * - 位置是计算结果，不持久化。
 */
export function packColumns(
  items: PackItem[],
  containerWidth: number,
  options: PackOptions = {},
): PackResult {
  const gap = options.gap ?? 16;
  const minColumnWidth = options.minColumnWidth ?? 420;
  const maxColumns = options.maxColumns ?? 3;
  const safeWidth = Math.max(1, containerWidth);
  const columnCount = Math.max(
    1,
    Math.min(
      maxColumns,
      Math.floor((safeWidth + gap) / (minColumnWidth + gap)),
    ),
  );
  const columnWidth = Math.max(
    1,
    (safeWidth - gap * (columnCount - 1)) / columnCount,
  );
  const heights = new Array<number>(columnCount).fill(0);
  const cards: PackedCard[] = [];

  for (const item of items) {
    const span = Math.max(1, Math.min(columnCount, Math.round(item.span)));
    let bestStart = 0;
    let bestY = Number.POSITIVE_INFINITY;
    for (let start = 0; start <= columnCount - span; start += 1) {
      const y = Math.max(...heights.slice(start, start + span));
      if (y < bestY) {
        bestY = y;
        bestStart = start;
      }
    }
    const width = span * columnWidth + (span - 1) * gap;
    const y = Number.isFinite(bestY) ? bestY : 0;
    cards.push({
      id: item.id,
      x: bestStart * (columnWidth + gap),
      y,
      width,
      height: item.height,
      span,
    });
    for (let index = bestStart; index < bestStart + span; index += 1) {
      heights[index] = y + item.height + gap;
    }
  }

  return {
    cards,
    width: safeWidth,
    height: Math.max(0, ...heights),
    columnWidth,
    columnCount,
  };
}

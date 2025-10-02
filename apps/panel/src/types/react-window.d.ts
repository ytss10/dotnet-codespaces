declare module "react-window" {
  import type { CSSProperties, ComponentType } from "react";

  interface GridChildComponentProps<ItemData = unknown> {
    columnIndex: number;
    rowIndex: number;
    data: ItemData;
    key: string;
    style: CSSProperties;
    isScrolling?: boolean;
  }

  interface FixedSizeGridProps<ItemData = unknown> {
    columnCount: number;
    columnWidth: number;
    height: number;
    rowCount: number;
    rowHeight: number;
    width: number;
    children: ComponentType<GridChildComponentProps<ItemData>>;
    itemData?: ItemData;
    outerElementType?: ComponentType<unknown> | keyof JSX.IntrinsicElements;
    innerElementType?: ComponentType<unknown> | keyof JSX.IntrinsicElements;
    className?: string;
    style?: CSSProperties;
    useIsScrolling?: boolean;
    overscanRowCount?: number;
    overscanColumnCount?: number;
  }

  export const FixedSizeGrid: {
    <ItemData = unknown>(props: FixedSizeGridProps<ItemData>): JSX.Element;
    displayName?: string;
  };

  export type GridChildComponent<ItemData = unknown> = ComponentType<GridChildComponentProps<ItemData>>;

  export type FixedSizeGridPropsType<ItemData = unknown> = FixedSizeGridProps<ItemData>;
}

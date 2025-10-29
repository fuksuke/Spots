declare module "rbush" {
  export interface RBushBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export default class RBush<T extends RBushBBox = RBushBBox> {
    constructor(maxEntries?: number);
    insert(item: T): RBush<T>;
    remove(item: T, equals?: (a: T, b: T) => boolean): RBush<T>;
    search(bbox: RBushBBox): T[];
    all(): T[];
    clear(): RBush<T>;
  }
}

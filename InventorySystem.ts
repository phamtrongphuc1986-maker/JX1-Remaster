import {
    InventoryItemData
} from './InventoryItem';

export interface InventoryPlacement {
    item: InventoryItemData;
    x: number;
    y: number;
}

export type InventoryAddReason =
    | 'added'
    | 'inventory_full'
    | 'no_space_for_item'
    | 'duplicate_id'
    | 'invalid_item';

export interface InventoryAddResult {
    success: boolean;
    reason: InventoryAddReason;
    placement?: InventoryPlacement;
}

export class InventorySystem {
    readonly columns = 10;
    readonly rows = 6;
    readonly capacity = 60;

    private cells: Array<string | null> = [];
    private placements: InventoryPlacement[] = [];

    constructor() {
        this.cells = new Array(this.capacity).fill(null);
    }

    get occupiedCount(): number {
        let count = 0;

        for (const cell of this.cells) {
            if (cell !== null) count++;
        }

        return count;
    }

    get emptyCount(): number {
        return this.capacity - this.occupiedCount;
    }

    get isCompletelyFull(): boolean {
        return this.occupiedCount >= this.capacity;
    }

    get canMove(): boolean {
        return !this.isCompletelyFull;
    }

    getItems(): InventoryPlacement[] {
        return this.placements.map(entry => ({
            item: { ...entry.item },
            x: entry.x,
            y: entry.y
        }));
    }

    getCellOwner(x: number, y: number): string | null {
        if (!this.isInside(x, y)) return null;
        return this.cells[this.toIndex(x, y)];
    }

    tryAdd(item: InventoryItemData): InventoryAddResult {
        if (
            !item ||
            !item.id ||
            !item.name ||
            !Number.isInteger(item.width) ||
            !Number.isInteger(item.height) ||
            item.width < 1 ||
            item.height < 1 ||
            item.width > this.columns ||
            item.height > this.rows ||
            item.quantity < 1
        ) {
            return {
                success: false,
                reason: 'invalid_item'
            };
        }

        if (this.placements.some(entry => entry.item.id === item.id)) {
            return {
                success: false,
                reason: 'duplicate_id'
            };
        }

        if (this.isCompletelyFull) {
            return {
                success: false,
                reason: 'inventory_full'
            };
        }

        for (let y = 0; y <= this.rows - item.height; y++) {
            for (let x = 0; x <= this.columns - item.width; x++) {
                if (!this.canPlaceAt(item, x, y)) continue;

                this.fillCells(item, x, y);

                const placement: InventoryPlacement = {
                    item: { ...item },
                    x,
                    y
                };

                this.placements.push(placement);

                return {
                    success: true,
                    reason: 'added',
                    placement
                };
            }
        }

        return {
            success: false,
            reason: 'no_space_for_item'
        };
    }

    removeItem(itemId: string): boolean {
        const index = this.placements.findIndex(
            entry => entry.item.id === itemId
        );

        if (index < 0) return false;

        const placement = this.placements[index];
        const item = placement.item;

        for (let y = placement.y; y < placement.y + item.height; y++) {
            for (let x = placement.x; x < placement.x + item.width; x++) {
                const cellIndex = this.toIndex(x, y);

                if (this.cells[cellIndex] === itemId) {
                    this.cells[cellIndex] = null;
                }
            }
        }

        this.placements.splice(index, 1);
        return true;
    }

    clear(): void {
        this.cells.fill(null);
        this.placements = [];
    }

    private canPlaceAt(
        item: InventoryItemData,
        startX: number,
        startY: number
    ): boolean {
        for (let y = startY; y < startY + item.height; y++) {
            for (let x = startX; x < startX + item.width; x++) {
                if (this.cells[this.toIndex(x, y)] !== null) {
                    return false;
                }
            }
        }

        return true;
    }

    private fillCells(
        item: InventoryItemData,
        startX: number,
        startY: number
    ): void {
        for (let y = startY; y < startY + item.height; y++) {
            for (let x = startX; x < startX + item.width; x++) {
                this.cells[this.toIndex(x, y)] = item.id;
            }
        }
    }

    private isInside(x: number, y: number): boolean {
        return (
            Number.isInteger(x) &&
            Number.isInteger(y) &&
            x >= 0 &&
            y >= 0 &&
            x < this.columns &&
            y < this.rows
        );
    }

    private toIndex(x: number, y: number): number {
        return y * this.columns + x;
    }
}

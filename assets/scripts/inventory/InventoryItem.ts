export type InventoryItemType =
    | 'helmet'
    | 'gloves'
    | 'armor'
    | 'belt'
    | 'shoes'
    | 'sabre'
    | 'staff'
    | 'spear'
    | 'halberd'
    | 'lance'
    | 'mace'
    | 'dual_daggers'
    | 'throwing_star'
    | 'throwing_knife'
    | 'upper_ring'
    | 'lower_ring'
    | 'jade_pendant'
    | 'necklace'
    | 'material'
    | 'consumable'
    | 'travel_talisman'
    | 'return_talisman';

export interface InventoryItemData {
    id: string;
    name: string;
    type: InventoryItemType;
    level: number;
    width: number;
    height: number;
    quantity: number;
}

export interface InventoryFootprint {
    width: number;
    height: number;
}

export function getInventoryFootprint(
    type: InventoryItemType,
    level: number = 1
): InventoryFootprint {
    switch (type) {
        case 'helmet':
        case 'shoes':
        case 'mace':
            return { width: 2, height: 2 };

        case 'gloves':
            return { width: 1, height: 2 };

        case 'armor':
            return { width: 1, height: 6 };

        case 'belt':
        case 'necklace':
            return { width: 2, height: 1 };

        case 'sabre':
        case 'staff':
        case 'spear':
        case 'halberd':
        case 'lance': {
            if (level <= 3) {
                return { width: 1, height: 2 };
            }

            if (level <= 5) {
                return { width: 1, height: 3 };
            }

            if (level <= 8) {
                return { width: 1, height: 5 };
            }

            return { width: 1, height: 6 };
        }

        case 'dual_daggers':
            return { width: 1, height: 6 };

        case 'jade_pendant':
            return { width: 1, height: 2 };

        case 'throwing_star':
        case 'throwing_knife':
        case 'upper_ring':
        case 'lower_ring':
        case 'material':
        case 'consumable':
        case 'travel_talisman':
        case 'return_talisman':
        default:
            return { width: 1, height: 1 };
    }
}

export function createInventoryItem(
    id: string,
    name: string,
    type: InventoryItemType,
    level: number = 1,
    quantity: number = 1
): InventoryItemData {
    const size = getInventoryFootprint(type, level);

    return {
        id,
        name,
        type,
        level,
        width: size.width,
        height: size.height,
        quantity: Math.max(1, quantity)
    };
}

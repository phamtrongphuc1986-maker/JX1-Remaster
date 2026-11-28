export enum CharacterDirection {
    SOUTH = 'south',
    NORTH = 'north',
    WEST = 'west',
    EAST = 'east',

    SOUTH_WEST = 'south_west',
    SOUTH_EAST = 'south_east',
    NORTH_WEST = 'north_west',
    NORTH_EAST = 'north_east'
}

export class CharacterDirectionHelper {
    static fromDelta(
        dx: number,
        dy: number
    ): CharacterDirection {
        if (dx < 0 && dy < 0) {
            return CharacterDirection.NORTH_WEST;
        }

        if (dx > 0 && dy < 0) {
            return CharacterDirection.NORTH_EAST;
        }

        if (dx < 0 && dy > 0) {
            return CharacterDirection.SOUTH_WEST;
        }

        if (dx > 0 && dy > 0) {
            return CharacterDirection.SOUTH_EAST;
        }

        if (dx < 0) return CharacterDirection.WEST;
        if (dx > 0) return CharacterDirection.EAST;
        if (dy < 0) return CharacterDirection.NORTH;

        return CharacterDirection.SOUTH;
    }
}

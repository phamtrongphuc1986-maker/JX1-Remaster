import { MapDefinition } from './MapDataTypes';

export class MapDataLoader {

    static validate(data: MapDefinition): string[] {
        const errors: string[] = [];

        if (!data.map_id) errors.push('Thieu map_id');
        if (!data.name) errors.push('Thieu ten ban do');

        if (data.projection !== 'isometric') {
            errors.push('Projection phai la isometric');
        }

        if (data.tile_width !== 64 || data.tile_height !== 32) {
            errors.push('Kich thuoc tile phai la 64x32');
        }

        if (data.width <= 0 || data.height <= 0) {
            errors.push('Kich thuoc ban do khong hop le');
        }

        if (!data.spawn_points || data.spawn_points.length === 0) {
            errors.push('Ban do chua co diem spawn');
        }

        for (const cell of data.blocked_cells || []) {
            const [x, y] = cell;

            if (
                x < 0 || y < 0 ||
                x >= data.width || y >= data.height
            ) {
                errors.push(`O chan nam ngoai ban do: ${x},${y}`);
            }
        }

        for (const spawn of data.spawn_points || []) {
            if (
                spawn.x < 0 || spawn.y < 0 ||
                spawn.x >= data.width || spawn.y >= data.height
            ) {
                errors.push(`Spawn nam ngoai ban do: ${spawn.id}`);
            }
        }

        return errors;
    }

    static isWalkable(
        data: MapDefinition,
        x: number,
        y: number
    ): boolean {
        if (
            x < 0 || y < 0 ||
            x >= data.width || y >= data.height
        ) {
            return false;
        }

        return !(data.blocked_cells || []).some(
            cell => cell[0] === x && cell[1] === y
        );
    }
}

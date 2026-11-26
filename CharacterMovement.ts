import { MapDefinition } from '../MapDataTypes';
import { MapDataLoader } from '../MapDataLoader';
import { CharacterData } from './CharacterData';

export interface MovementResult {
    moved: boolean;
    gridX: number;
    gridY: number;
    reason?: string;
}

export class CharacterMovement {
    static tryMove(
        character: CharacterData,
        map: MapDefinition,
        dx: number,
        dy: number
    ): MovementResult {
        if (
            Math.abs(dx) > 1 ||
            Math.abs(dy) > 1 ||
            (dx === 0 && dy === 0)
        ) {
            return {
                moved: false,
                gridX: character.gridX,
                gridY: character.gridY,
                reason: 'Huong di chuyen khong hop le'
            };
        }

        const nextX = character.gridX + dx;
        const nextY = character.gridY + dy;

        // Không cho đi ra ngoài bản đồ hoặc xuyên vật cản.
        if (!MapDataLoader.isWalkable(map, nextX, nextY)) {
            return {
                moved: false,
                gridX: character.gridX,
                gridY: character.gridY,
                reason: 'O di chuyen bi chan'
            };
        }

        // Khi đi chéo, phải kiểm tra hai ô cạnh để tránh xuyên góc.
        if (dx !== 0 && dy !== 0) {
            const horizontalWalkable = MapDataLoader.isWalkable(
                map,
                character.gridX + dx,
                character.gridY
            );

            const verticalWalkable = MapDataLoader.isWalkable(
                map,
                character.gridX,
                character.gridY + dy
            );

            if (!horizontalWalkable || !verticalWalkable) {
                return {
                    moved: false,
                    gridX: character.gridX,
                    gridY: character.gridY,
                    reason: 'Khong the di cheo qua goc vat can'
                };
            }
        }

        return {
            moved: true,
            gridX: nextX,
            gridY: nextY
        };
    }
}

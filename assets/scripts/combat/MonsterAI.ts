import { MapDefinition } from '../MapDataTypes';
import { MapDataLoader } from '../MapDataLoader';
import { CharacterController } from '../character/CharacterController';
import { MonsterController } from './MonsterController';

export class MonsterAI {
    static update(
        monster: MonsterController,
        player: CharacterController,
        map: MapDefinition
    ): 'attack' | 'move' | 'idle' {
        if (!monster.isAlive || player.data.hp <= 0) {
            return 'idle';
        }

        const dx = player.data.gridX - monster.data.gridX;
        const dy = player.data.gridY - monster.data.gridY;

        const distance = Math.max(
            Math.abs(dx),
            Math.abs(dy)
        );

        // Quái vật chỉ phản ứng trong phạm vi 5 ô.
        if (distance > 5) return 'idle';

        // Đứng cạnh người chơi thì chuyển sang tấn công.
        if (distance <= 1) return 'attack';

        const stepX = dx === 0 ? 0 : Math.sign(dx);
        const stepY = dy === 0 ? 0 : Math.sign(dy);

        const nextX = monster.data.gridX + stepX;
        const nextY = monster.data.gridY + stepY;

        // Kiểm tra ô đi được và không đi xuyên góc vật cản.
        if (
            stepX !== 0 &&
            stepY !== 0 &&
            (
                !MapDataLoader.isWalkable(
                    map,
                    monster.data.gridX + stepX,
                    monster.data.gridY
                ) ||
                !MapDataLoader.isWalkable(
                    map,
                    monster.data.gridX,
                    monster.data.gridY + stepY
                )
            )
        ) {
            return 'idle';
        }

        if (MapDataLoader.isWalkable(map, nextX, nextY)) {
            monster.moveTo(nextX, nextY);
            return 'move';
        }

        return 'idle';
    }
}

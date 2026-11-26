import { CharacterController } from '../character/CharacterController';
import { MonsterController } from './MonsterController';

export interface AttackResult {
    hit: boolean;
    damage: number;
    defeated: boolean;
    message: string;
}

export class CombatSystem {
    static playerAttack(
        player: CharacterController,
        monster: MonsterController
    ): AttackResult {
        if (!monster.isAlive) {
            return {
                hit: false,
                damage: 0,
                defeated: false,
                message: 'Quai vat da bi tieu diet'
            };
        }

        const dx = Math.abs(
            player.data.gridX - monster.data.gridX
        );
        const dy = Math.abs(
            player.data.gridY - monster.data.gridY
        );

        // Tam danh 1 o xung quanh, gom ca huong cheo.
        if (Math.max(dx, dy) > 1) {
            return {
                hit: false,
                damage: 0,
                defeated: false,
                message: 'Quai vat o qua xa'
            };
        }

        const baseDamage = 12 + player.data.level * 2;
        const damage = Math.max(
            1,
            baseDamage - monster.data.defense
        );

        const actualDamage = monster.takeDamage(damage);

        return {
            hit: true,
            damage: actualDamage,
            defeated: !monster.isAlive,
            message: monster.isAlive
                ? 'Gay ' + actualDamage + ' sat thuong'
                : 'Da tieu diet quai vat!'
        };
    }

    static monsterAttack(
        monster: MonsterController,
        player: CharacterController
    ): number {
        if (!monster.isAlive) return 0;

        const damage = Math.max(
            1,
            monster.data.attack - Math.floor(player.data.level / 2)
        );

        player.takeDamage(damage);
        return damage;
    }
}

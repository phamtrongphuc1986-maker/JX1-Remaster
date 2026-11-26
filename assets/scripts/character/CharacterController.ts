import { MapDefinition } from '../MapDataTypes';
import {
    CharacterData,
    createCharacterData
} from './CharacterData';
import { CharacterDirection, CharacterDirectionHelper } from './CharacterDirection';
import { CharacterMovement, MovementResult } from './CharacterMovement';

export class CharacterController {
    readonly data: CharacterData;

    direction: CharacterDirection = CharacterDirection.SOUTH;

    constructor(spawnX: number, spawnY: number) {
        this.data = createCharacterData(spawnX, spawnY);
    }

    move(
        map: MapDefinition,
        dx: number,
        dy: number
    ): MovementResult {
        if (dx === 0 && dy === 0) {
            return {
                moved: false,
                gridX: this.data.gridX,
                gridY: this.data.gridY,
                reason: 'Nhan vat dang dung yen'
            };
        }

        this.direction = CharacterDirectionHelper.fromDelta(dx, dy);

        const result = CharacterMovement.tryMove(
            this.data,
            map,
            dx,
            dy
        );

        if (result.moved) {
            this.data.gridX = result.gridX;
            this.data.gridY = result.gridY;
        }

        return result;
    }

    setPosition(x: number, y: number): void {
        this.data.gridX = x;
        this.data.gridY = y;
    }

    setMapSpawn(x: number, y: number): void {
        this.setPosition(x, y);
    }

    takeDamage(amount: number): void {
        const damage = Math.max(0, Math.floor(amount));
        this.data.hp = Math.max(0, this.data.hp - damage);
    }

    heal(amount: number): void {
        const value = Math.max(0, Math.floor(amount));
        this.data.hp = Math.min(
            this.data.maxHp,
            this.data.hp + value
        );
    }

    useMana(amount: number): boolean {
        const cost = Math.max(0, Math.floor(amount));

        if (this.data.mp < cost) {
            return false;
        }

        this.data.mp -= cost;
        return true;
    }

    restoreMana(amount: number): void {
        const value = Math.max(0, Math.floor(amount));
        this.data.mp = Math.min(
            this.data.maxMp,
            this.data.mp + value
        );
    }

    // C4: Kinh nghiem va tang cap nhan vat.
    getExpToNextLevel(): number {
        return this.data.level * 100;
    }

    gainExp(amount: number): number {
        const value = Math.max(0, Math.floor(amount));
        if (value <= 0) return 0;

        this.data.exp += value;
        let levelsGained = 0;

        while (this.data.exp >= this.getExpToNextLevel()) {
            this.data.exp -= this.getExpToNextLevel();
            this.data.level += 1;

            this.data.maxHp += 10;
            this.data.maxMp += 5;

            this.data.hp = this.data.maxHp;
            this.data.mp = this.data.maxMp;

            levelsGained += 1;
        }

        return levelsGained;
    }
}

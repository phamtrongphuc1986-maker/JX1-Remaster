import { MonsterData } from './MonsterData';

export class MonsterController {
    constructor(readonly data: MonsterData) {}

    takeDamage(amount: number): number {
        if (!this.data.alive) return 0;

        const damage = Math.max(1, Math.floor(amount));
        const actualDamage = Math.min(this.data.hp, damage);

        this.data.hp -= actualDamage;

        if (this.data.hp <= 0) {
            this.data.hp = 0;
            this.data.alive = false;
        }

        return actualDamage;
    }

    moveTo(x: number, y: number): void {
        if (!this.data.alive) return;

        this.data.gridX = x;
        this.data.gridY = y;
    }

    get isAlive(): boolean {
        return this.data.alive;
    }
}

export interface MonsterData {
    id: string;
    name: string;
    level: number;

    hp: number;
    maxHp: number;

    attack: number;
    defense: number;

    gridX: number;
    gridY: number;

    expReward: number;
    alive: boolean;
}

export function createMonster(
    id: string,
    name: string,
    x: number,
    y: number
): MonsterData {
    return {
        id,
        name,
        level: 1,
        hp: 60,
        maxHp: 60,
        attack: 5,
        defense: 1,
        gridX: x,
        gridY: y,
        expReward: 20,
        alive: true
    };
}

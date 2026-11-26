export interface CharacterData {
    id: string;
    name: string;
    level: number;
    exp: number;

    hp: number;
    maxHp: number;

    mp: number;
    maxMp: number;

    gridX: number;
    gridY: number;
}

export function createCharacterData(
    spawnX: number,
    spawnY: number
): CharacterData {
    return {
        id: 'player_001',
        name: 'Vo Lam',
        level: 1,
    exp: 0,

        hp: 100,
        maxHp: 100,

        mp: 100,
        maxMp: 100,

        gridX: spawnX,
        gridY: spawnY
    };
}

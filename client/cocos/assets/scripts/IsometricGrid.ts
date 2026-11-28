export class IsometricGrid {
    static readonly TILE_WIDTH = 64;
    static readonly TILE_HEIGHT = 32;

    static gridToLocal(x: number, y: number) {
        return {
            x: (x - y) * 32,
            y: -(x + y) * 16
        };
    }

    static localToGrid(px: number, py: number) {
        const a = px / 32;
        const b = -py / 16;

        return {
            x: Math.round((a + b) / 2),
            y: Math.round((b - a) / 2)
        };
    }
}

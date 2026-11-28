import { Node } from 'cc';
import { IsometricGrid } from './IsometricGrid';

export class MapCameraBounds {

    static clamp(
        cameraNode: Node,
        target: Node,
        mapWidth: number,
        mapHeight: number,
        viewWidth: number,
        viewHeight: number
    ) {
        const halfW = IsometricGrid.TILE_WIDTH / 2;
        const halfH = IsometricGrid.TILE_HEIGHT / 2;

        const minX = -mapHeight * halfW;
        const maxX = mapWidth * halfW;

        const minY = -(mapWidth + mapHeight - 1) * halfH;
        const maxY = halfH;

        const minCameraX = minX + viewWidth / 2;
        const maxCameraX = maxX - viewWidth / 2;

        const minCameraY = minY + viewHeight / 2;
        const maxCameraY = maxY - viewHeight / 2;

        const p = target.position;

        const x = minCameraX > maxCameraX
            ? (minX + maxX) / 2
            : Math.max(minCameraX, Math.min(maxCameraX, p.x));

        const y = minCameraY > maxCameraY
            ? (minY + maxY) / 2
            : Math.max(minCameraY, Math.min(maxCameraY, p.y));

        cameraNode.setPosition(
            x,
            y,
            cameraNode.position.z
        );
    }
}

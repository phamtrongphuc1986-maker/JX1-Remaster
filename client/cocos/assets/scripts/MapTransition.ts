import { JsonAsset, resources } from 'cc';
import { MapDefinition, PortalData } from './MapDataTypes';
import { MapDataLoader } from './MapDataLoader';

export interface MapTransitionResult {
    mapData: MapDefinition;
    spawnX: number;
    spawnY: number;
    portalId: string;
}

export class MapTransition {

    static findPortal(
        map: MapDefinition,
        portalId: string
    ): PortalData | undefined {
        return map.portals.find(p => p.id === portalId);
    }

    static loadTarget(
        currentMap: MapDefinition,
        portalId: string,
        callback: (
            error: string | null,
            result?: MapTransitionResult
        ) => void
    ) {
        const portal = this.findPortal(currentMap, portalId);

        if (!portal) {
            callback('Khong tim thay cong dich chuyen');
            return;
        }

        resources.load(
            `maps/${portal.target_map_id}`,
            JsonAsset,
            (err, asset) => {
                if (err || !asset) {
                    callback('Khong nap duoc ban do dich');
                    return;
                }

                const target = asset.json as MapDefinition;
                const errors = MapDataLoader.validate(target);

                if (errors.length > 0) {
                    callback(errors.join('; '));
                    return;
                }

                if (!MapDataLoader.isWalkable(
                    target,
                    portal.target_x,
                    portal.target_y
                )) {
                    callback('Vi tri den bi chan hoac nam ngoai ban do');
                    return;
                }

                callback(null, {
                    mapData: target,
                    spawnX: portal.target_x,
                    spawnY: portal.target_y,
                    portalId: portal.id
                });
            }
        );
    }
}

import { JsonAsset, resources } from 'cc';
import { MapDefinition } from './MapDataTypes';
import { MapDataLoader } from './MapDataLoader';

/** C4.14.5 - Danh sach diem den duoc phep chon bang Than Hanh Phu. */
export interface TeleportDestination {
    id: string;
    name: string;
    mapId: string;
}

export interface SavedReturnPoint {
    mapId: string;
    mapName: string;
    x: number;
    y: number;
}

export const TELEPORT_DESTINATIONS: TeleportDestination[] = [
    { id: 'tuong_duong', name: 'Tương Dương', mapId: 'map_tuong_duong' },
    { id: 'thanh_do', name: 'Thành Đô', mapId: 'map_thanh_do' },
    { id: 'bien_kinh', name: 'Biện Kinh', mapId: 'map_bien_kinh' },
    { id: 'lam_an', name: 'Lâm An', mapId: 'map_lam_an' },
    { id: 'dai_ly', name: 'Đại Lý', mapId: 'map_dai_ly' },
    { id: 'duong_chau', name: 'Dương Châu', mapId: 'map_duong_chau' },
    { id: 'phuong_tuong', name: 'Phượng Tường', mapId: 'map_phuong_tuong' },
    { id: 'ba_lang_huyen', name: 'Ba Lăng Huyện', mapId: 'map_ba_lang_huyen' },
    { id: 'nam_nhac_tran', name: 'Nam Nhạc Trấn', mapId: 'map_nam_nhac_tran' },
    { id: 'long_mon_tran', name: 'Long Môn Trấn', mapId: 'map_long_mon_tran' },
    { id: 'vinh_lac_tran', name: 'Vĩnh Lạc Trấn', mapId: 'map_vinh_lac_tran' },
    { id: 'giang_tan_thon', name: 'Giang Tân Thôn', mapId: 'map_giang_tan_thon' },
    { id: 'chu_tien_tran', name: 'Chu Tiên Trấn', mapId: 'map_chu_tien_tran' },
    { id: 'long_tuyen_thon', name: 'Long Tuyền Thôn', mapId: 'map_long_tuyen_thon' },
    { id: 'thach_co_tran', name: 'Thạch Cổ Trấn', mapId: 'map_thach_co_tran' },
    { id: 'dao_huong_thon', name: 'Đạo Hương Thôn', mapId: 'map_dao_huong_thon' },
    { id: 'tien_doi_noi', name: 'Tiên Đôi Nội', mapId: 'map_tien_doi_noi' },
    { id: 'doan_lap', name: 'Đoàn Lập', mapId: 'map_doan_lap' },
    { id: 'tan_minh', name: 'Tân Minh', mapId: 'map_tan_minh' },
    { id: 'tien_lang', name: 'Tiên Lãng', mapId: 'map_tien_lang' },
    { id: 'hai_phong', name: 'Hải Phòng', mapId: 'map_hai_phong' }
];

export class TeleportationSystem {
    private returnPoint: SavedReturnPoint | null = null;

    saveReturnPoint(map: MapDefinition, x: number, y: number): void {
        if (!MapDataLoader.isWalkable(map, x, y)) return;
        this.returnPoint = { mapId: map.map_id, mapName: map.name, x, y };
    }

    getSavedReturnPoint(): SavedReturnPoint | null {
        return this.returnPoint ? { ...this.returnPoint } : null;
    }

    loadMap(mapId: string, x: number | null, y: number | null,
        callback: (error: string | null, map?: MapDefinition, targetX?: number, targetY?: number) => void): void {
        if (!mapId) {
            callback('Khong co ma ban do dich.');
            return;
        }
        resources.load(`maps/${mapId}`, JsonAsset, (err, asset) => {
            if (err || !asset) {
                callback(`Ban do '${mapId}' chua co trong bo du lieu hien tai.`);
                return;
            }
            const map = asset.json as MapDefinition;
            const errors = MapDataLoader.validate(map);
            if (errors.length) {
                callback('Du lieu ban do dich khong hop le: ' + errors.join('; '));
                return;
            }
            let targetX = x;
            let targetY = y;
            if (targetX === null || targetY === null) {
                const spawn = map.spawn_points.find(p => p.type === 'player') || map.spawn_points[0];
                if (!spawn) {
                    callback('Ban do dich chua co diem xuat hien.');
                    return;
                }
                targetX = spawn.x;
                targetY = spawn.y;
            }
            if (!MapDataLoader.isWalkable(map, targetX, targetY)) {
                callback('Toa do dich khong hop le hoac bi chan.');
                return;
            }
            callback(null, map, targetX, targetY);
        });
    }
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface SpawnPoint extends GridPoint {
    id: string;
    type: string;
}

export interface NPCData extends GridPoint {
    id: string;
    name: string;
}

export interface MonsterSpawn extends GridPoint {
    id: string;
    monster_id: string;
    count: number;
}

export interface PortalData extends GridPoint {
    id: string;
    target_map_id: string;
    target_x: number;
    target_y: number;
}

export interface MapDefinition {
    map_id: string;
    name: string;
    projection: "isometric";
    tile_width: number;
    tile_height: number;
    width: number;
    height: number;
    layers: string[];
    spawn_points: SpawnPoint[];
    npcs: NPCData[];
    monster_spawns: MonsterSpawn[];
    portals: PortalData[];
    blocked_cells: number[][];
    notes?: string;
}

export interface ApiError {
    error?: string;
    message?: string;
}

export interface ApiUser {
    id: number;
    username: string;
}

export interface ApiLoginResponse {
    message: string;
    user: ApiUser;
    token: string;
    expires_at: string;
}

export interface ApiCharacter {
    id: number;
    name: string;
    class_id: number;
    class_name: string;
    level: number;
}

export interface ApiCharacterList {
    characters: ApiCharacter[];
}

export interface ApiClass {
    id: number;
    name: string;
    description?: string;
}

export interface ApiClassList {
    count: number;
    classes: ApiClass[];
}

export interface ApiCharacterStats {
    character_id: number;
    hp: number;
    mp: number;
    strength: number;
    agility: number;
    attack: number;
    defense: number;
    potential_points: number;
    skill_points: number;
    spent_points: number;
}

export interface ApiResult<T> {
    ok: boolean;
    status: number;
    data?: T;
    error?: string;
}

/**
 * HTTP client for the REST endpoints currently implemented by server/main.go.
 * The server URL must be supplied by the caller; do not hard-code a VPS address.
 * Tokens remain in memory only and are never written to local storage.
 */
export class GameApi {
    private token: string | null = null;
    private readonly baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }

    setToken(token: string | null): void {
        this.token = token && token.trim() ? token.trim() : null;
    }

    clearToken(): void {
        this.token = null;
    }

    register(username: string, password: string): Promise<ApiResult<{ message: string; user: ApiUser }>> {
        return this.request('/api/register', 'POST', { username, password }, false);
    }

    login(username: string, password: string): Promise<ApiResult<ApiLoginResponse>> {
        return this.request<ApiLoginResponse>('/api/login', 'POST', { username, password }, false)
            .then(result => {
                if (result.ok && result.data?.token) this.setToken(result.data.token);
                return result;
            });
    }

    listClasses(): Promise<ApiResult<ApiClassList>> {
        return this.request('/api/classes', 'GET', undefined, false);
    }

    listCharacters(): Promise<ApiResult<ApiCharacterList>> {
        return this.request('/api/characters', 'GET');
    }

    createCharacter(name: string, classId: number): Promise<ApiResult<ApiCharacter>> {
        return this.request('/api/characters/create', 'POST', {
            name,
            class_id: classId
        });
    }

    getCharacterStats(characterId: number): Promise<ApiResult<ApiCharacterStats>> {
        return this.request('/api/characters/stats?character_id=' + encodeURIComponent(String(characterId)), 'GET');
    }

    allocateStat(characterId: number, attribute: 'hp' | 'mp' | 'strength' | 'agility' | 'attack' | 'defense'): Promise<ApiResult<{ message: string; stats: ApiCharacterStats }>> {
        return this.request('/api/characters/allocate', 'POST', {
            character_id: characterId,
            attribute
        });
    }

    listSkills(classId: number): Promise<ApiResult<unknown[]>> {
        return this.request('/api/skills?class_id=' + encodeURIComponent(String(classId)), 'GET', false as unknown as undefined, false);
    }

    listCharacterSkills(characterId: number): Promise<ApiResult<unknown[]>> {
        return this.request('/api/characters/skills?character_id=' + encodeURIComponent(String(characterId)), 'GET');
    }

    learnSkill(characterId: number, skillId: number): Promise<ApiResult<{ success: boolean; message: string }>> {
        return this.request('/api/skills/learn', 'POST', {
            character_id: characterId,
            skill_id: skillId
        });
    }

    upgradeSkill(characterId: number, skillId: number): Promise<ApiResult<{ success: boolean; message: string }>> {
        return this.request('/api/skills/upgrade', 'POST', {
            character_id: characterId,
            skill_id: skillId
        });
    }

    listMonsters(characterId: number): Promise<ApiResult<unknown[]>> {
        return this.request('/api/monsters?character_id=' + encodeURIComponent(String(characterId)), 'GET');
    }

    attackMonster(characterId: number, monsterId: number): Promise<ApiResult<Record<string, unknown>>> {
        return this.request('/api/combat/attack', 'POST', {
            character_id: characterId,
            monster_id: monsterId
        });
    }

    reviveCharacter(characterId: number): Promise<ApiResult<Record<string, unknown>>> {
        return this.request('/api/characters/revive', 'POST', {
            character_id: characterId
        });
    }

    getInventory(characterId: number): Promise<ApiResult<unknown[]>> {
        return this.request('/api/inventory?character_id=' + encodeURIComponent(String(characterId)), 'GET');
    }

    useItem(characterId: number, itemId: number): Promise<ApiResult<Record<string, unknown>>> {
        return this.request('/api/items/use', 'POST', {
            character_id: characterId,
            item_id: itemId
        });
    }

    private request<T>(
        path: string,
        method: 'GET' | 'POST',
        body?: unknown,
        authenticated = true
    ): Promise<ApiResult<T>> {
        if (!this.baseUrl) {
            return Promise.resolve({
                ok: false,
                status: 0,
                error: 'Chưa cấu hình địa chỉ server.'
            });
        }
        if (authenticated && !this.token) {
            return Promise.resolve({
                ok: false,
                status: 0,
                error: 'Bạn chưa đăng nhập hoặc phiên chưa có token.'
            });
        }

        return new Promise(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, this.baseUrl + path, true);
            xhr.timeout = 10000;
            xhr.setRequestHeader('Accept', 'application/json');
            if (method === 'POST') {
                xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
            }
            if (authenticated && this.token) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + this.token);
            }

            xhr.onload = () => {
                const text = xhr.responseText || '';
                let data: T | undefined;
                let error: string | undefined;
                if (text) {
                    try {
                        const parsed = JSON.parse(text) as T & ApiError;
                        data = parsed as T;
                        error = parsed.error || parsed.message;
                    } catch {
                        error = text;
                    }
                }
                const ok = xhr.status >= 200 && xhr.status < 300;
                resolve({
                    ok,
                    status: xhr.status,
                    data: ok ? data : undefined,
                    error: ok ? undefined : (error || ('HTTP ' + xhr.status))
                });
            };
            xhr.onerror = () => resolve({
                ok: false,
                status: xhr.status || 0,
                error: 'Không kết nối được server. Hãy kiểm tra URL, mạng và HTTPS.'
            });
            xhr.ontimeout = () => resolve({
                ok: false,
                status: 0,
                error: 'Server phản hồi quá thời gian 10 giây.'
            });
            xhr.onabort = () => resolve({
                ok: false,
                status: 0,
                error: 'Yêu cầu đã bị hủy.'
            });

            if (method === 'POST') xhr.send(JSON.stringify(body ?? {}));
            else xhr.send();
        });
    }
}

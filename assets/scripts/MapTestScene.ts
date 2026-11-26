import {
    _decorator,
    Component,
    Graphics,
    Node,
    Color,
    Label,
    UITransform,
    input,
    Input,
    EventKeyboard,
    EventTouch,
    KeyCode,
    JsonAsset,
    resources,
    Canvas,
    Camera,
    view
} from 'cc';

import { IsometricGrid } from './IsometricGrid';
import { MapDefinition } from './MapDataTypes';
import { MapDataLoader } from './MapDataLoader';
import { MapTransition } from './MapTransition';
import { MapCameraBounds } from './MapCameraBounds';
import { CharacterController } from './character/CharacterController';
import { CharacterAnimation } from './character/CharacterAnimation';
import { CharacterDirection } from './character/CharacterDirection';
import { createMonster } from './combat/MonsterData';
import { MonsterController } from './combat/MonsterController';
import { CombatSystem } from './combat/CombatSystem';
import { MonsterAI } from './combat/MonsterAI';
import { InventorySystem } from './inventory/InventorySystem';
import { TeleportationSystem, TELEPORT_DESTINATIONS, TeleportDestination } from './TeleportationSystem';
import {
    InventoryItemData,
    createInventoryItem
} from './inventory/InventoryItem';

const { ccclass, property } = _decorator;

@ccclass('MapTestScene')
export class MapTestScene extends Component {

    @property(Node)
    cameraNode: Node | null = null;

    @property
    viewWidth = 800;

    @property
    viewHeight = 450;

    private mapData: MapDefinition | null = null;
    private gridX = 9;
    private gridY = 12;
    private playerNode: Node | null = null;
    private transitioning = false;
    private playerDead = false;
    // C4.10: Thoi gian hoi chieu ky nang danh lan.
    private skillCooldownRemaining = 0;
    // C4.11: Hoi chieu rieng cua ky nang kiem khi.
    private swordSkillCooldownRemaining = 0;
    private characterController: CharacterController | null = null;

    // C4.12: Giao dien dieu khien Android.
    private mobileCanvas: Node | null = null;
    private easyTouchNode: Node | null = null;
    private easyTouchKnob: Node | null = null;
    private mobileAutoButton: Node | null = null;
    private mobileAutoLabel: Label | null = null;
    // C4.13: Bang trang thai HP, MP, EXP va ky nang mobile.
    private mobileStatusLabel: Label | null = null;

    // C4.14: He thong tui do 60 o va vat pham roi.
    private inventory = new InventorySystem();
    // C4.14.5: dich chuyen bang Than Hanh Phu / Tho Dia Phu.
    private teleportation = new TeleportationSystem();
    private teleportPanel: Node | null = null;
    private teleportDestinationLabel: Label | null = null;
    private teleportDestinationIndex = 0;
    private teleportPanelMode: 'travel' | 'return' = 'travel';
    private droppedItems: Array<{
        node: Node;
        gridX: number;
        gridY: number;
        data: InventoryItemData;
    }> = [];
    private inventoryPanel: Node | null = null;
    private inventoryCountLabel: Label | null = null;
    // C4.14.4: Thong tin vat pham dang duoc chon.
    private inventoryDetailLabel: Label | null = null;
    private selectedInventoryItemId: string | null = null;
    private inventoryCellNodes: Node[] = [];
    private inventoryVisible = false;
    private joystickDX = 0;
    private joystickDY = 0;
    private joystickActive = false;
    private joystickMoveTimer = 0;
    private autoCombat = false;
    private autoCombatTimer = 0;
    private playerGraphics: Graphics | null = null;
    private playerHudGraphics: Graphics | null = null;
    private playerNameLabel: Label | null = null;
    private playerExpLabel: Label | null = null;
    private levelUpLabel: Label | null = null;
    private animationTime = 0;
    private walkAnimationRemaining = 0;
    private touchStartX = 0;
    private touchStartY = 0;
    private touchTracking = false;
private monsterControllers: MonsterController[] = [];
private monsterNodes: Node[] = [];
private monsterHpGraphics: Graphics[] = [];
private monsterThinkTimers: Map<MonsterController, number> = new Map();
private monsterAttackTimers: Map<MonsterController, number> = new Map();


    start() {
        this.createMobileControls();
        this.loadInitialMap();

        input.on(
            Input.EventType.KEY_DOWN,
            this.onKeyDown,
            this
        );

    }

    onDestroy() {
        input.off(
            Input.EventType.KEY_DOWN,
            this.onKeyDown,
            this
        );

    }

    private loadInitialMap() {
        resources.load(
            'maps/map_001_village_test',
            JsonAsset,
            (err, asset) => {
                if (err || !asset) {
                    console.error('Khong nap duoc map 001', err);
                    return;
                }

                const data = asset.json as MapDefinition;
                const errors = MapDataLoader.validate(data);

                if (errors.length > 0) {
                    console.error('JSON ban do loi:', errors);
                    return;
                }

                this.mapData = data;

                const spawn = data.spawn_points.find(
                    item => item.type === 'player'
                );

                if (!spawn) {
                    console.error('Thieu diem spawn');
                    return;
                }

                this.gridX = spawn.x;
                this.gridY = spawn.y;
                this.characterController = new CharacterController(spawn.x, spawn.y);

                this.drawGround();
                this.drawObstacles();
            this.drawMonsters();
                this.createPlayer();
                this.followCamera();

                console.log('Da vao map:', data.map_id);
            }
        );
    }

    update(dt: number) {
        this.animationTime += dt;
        this.skillCooldownRemaining = Math.max(
            0,
            this.skillCooldownRemaining - dt
        );
        this.swordSkillCooldownRemaining = Math.max(
            0,
            this.swordSkillCooldownRemaining - dt
        );
        this.walkAnimationRemaining = Math.max(
            0,
            this.walkAnimationRemaining - dt
        );

        // C4.9: Phat hien nhan vat tu tran.
        if (
            this.characterController &&
            this.characterController.data.hp <= 0 &&
            !this.playerDead
        ) {
            this.handlePlayerDeath();
        }

        if (this.playerDead) {
            this.updatePlayerHud();
            return;
        }

        if (this.playerGraphics && this.characterController) {
            CharacterAnimation.draw(
                this.playerGraphics,
                this.characterController.direction,
                this.animationTime,
                this.walkAnimationRemaining > 0
            );
        }

        this.updateMobileControls(dt);
        this.updateDroppedItems();
        this.updateMonsterAI(dt);
        this.updatePlayerHud();
    }


    // C4.12: Tao Canvas UI runtime, khong can tao Canvas thu cong trong Editor.
    private createMobileControls() {
        if (this.mobileCanvas) return;

        const visible = view.getVisibleSize();
        const root = new Node('MobileControlCanvas');
        root.layer = 1 << 25;
        root.setParent(this.node);

        const transform = root.addComponent(UITransform);
        transform.setContentSize(visible.width, visible.height);
        transform.setAnchorPoint(0.5, 0.5);

        const canvas = root.addComponent(Canvas);
        const camera = this.cameraNode
            ? this.cameraNode.getComponent(Camera)
            : null;

        if (camera) {
            canvas.cameraComponent = camera;
        } else {
            console.warn('C4.12: Chua tim thay Camera tren cameraNode.');
        }

        this.mobileCanvas = root;

        // C4.13: Bang thong tin mobile nam phia tren man hinh.
        const statusNode = new Node('MobileStatusPanel');
        statusNode.setParent(root);
        statusNode.setPosition(0, visible.height / 2 - 32, 0);

        const statusTransform = statusNode.addComponent(UITransform);
        statusTransform.setContentSize(
            Math.min(visible.width - 24, 520),
            52
        );
        statusTransform.setAnchorPoint(0.5, 0.5);

        this.mobileStatusLabel = statusNode.addComponent(Label);
        this.mobileStatusLabel.string = 'HP -- | MP -- | EXP --';
        this.mobileStatusLabel.fontSize = 12;
        this.mobileStatusLabel.lineHeight = 17;
        this.mobileStatusLabel.color = new Color(255, 245, 210, 128);

        // EasyTouch o goc trai duoi, alpha 50%.
        const joystick = new Node('EasyTouch');
        joystick.setParent(root);
        joystick.setPosition(
            -visible.width / 2 + 100,
            -visible.height / 2 + 105,
            0
        );
        joystick.addComponent(UITransform).setContentSize(160, 160);

        const base = joystick.addComponent(Graphics);
        base.fillColor = new Color(35, 45, 52, 128);
        base.circle(0, 0, 76);
        base.fill();

        base.fillColor = new Color(100, 110, 116, 128);
        base.circle(0, 0, 62);
        base.fill();

        base.fillColor = new Color(150, 153, 158, 128);
        base.circle(0, 0, 48);
        base.fill();

        this.easyTouchNode = joystick;

        const knob = new Node('EasyTouchCenter');
        knob.setParent(joystick);
        knob.addComponent(UITransform).setContentSize(90, 90);
        const knobGraphics = knob.addComponent(Graphics);
        knobGraphics.fillColor = new Color(255, 255, 255, 128);
        knobGraphics.circle(0, 0, 39);
        knobGraphics.fill();
        this.easyTouchKnob = knob;

        joystick.on(Node.EventType.TOUCH_START, this.onEasyTouchStart, this);
        joystick.on(Node.EventType.TOUCH_MOVE, this.onEasyTouchMove, this);
        joystick.on(Node.EventType.TOUCH_END, this.onEasyTouchEnd, this);
        joystick.on(Node.EventType.TOUCH_CANCEL, this.onEasyTouchEnd, this);

        // Cac nut hanh dong ben phai.
        const rightX = visible.width / 2 - 65;
        const bottomY = -visible.height / 2 + 75;

        this.createMobileButton(root, 'ATTACK', 'ĐÁNH',
            rightX - 150, bottomY, new Color(80, 105, 130, 220),
            () => this.attackNearestMonster());

        this.createMobileButton(root, 'SKILL_K', 'K',
            rightX - 100, bottomY + 75, new Color(40, 125, 205, 220),
            () => this.useAreaSkill());

        this.createMobileButton(root, 'SKILL_L', 'L',
            rightX - 35, bottomY + 75, new Color(190, 145, 45, 220),
            () => this.useSwordSkill());

        const auto = this.createMobileButton(root, 'AUTO', 'AUTO',
            rightX, bottomY + 5, new Color(55, 135, 80, 230),
            () => this.toggleAutoCombat());

        this.mobileAutoButton = auto;
        this.mobileAutoLabel = auto.getChildByName('ButtonLabel')
            ?.getComponent(Label) || null;

        // C4.14.3: Nut mo tui do 60 o.
        this.createMobileButton(
            root,
            'INVENTORY_BUTTON',
            'TUI DO',
            rightX - 145,
            bottomY + 155,
            new Color(125, 95, 55, 230),
            () => this.toggleInventoryPanel()
        );

        this.createInventoryPanel(root);
    }

    private createMobileButton(
        parent: Node,
        nodeName: string,
        caption: string,
        x: number,
        y: number,
        color: Color,
        action: () => void
    ): Node {
        const button = new Node(nodeName);
        button.setParent(parent);
        button.setPosition(x, y, 0);
        button.addComponent(UITransform).setContentSize(58, 58);

        const graphics = button.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.circle(0, 0, 28);
        graphics.fill();
        graphics.lineWidth = 2;
        graphics.strokeColor = new Color(235, 235, 235, 190);
        graphics.circle(0, 0, 28);
        graphics.stroke();

        const labelNode = new Node('ButtonLabel');
        labelNode.setParent(button);
        labelNode.addComponent(UITransform).setContentSize(66, 30);
        const label = labelNode.addComponent(Label);
        label.string = caption;
        label.fontSize = caption === 'AUTO' ? 12 : 15;
        label.lineHeight = 18;
        label.color = new Color(255, 255, 255, 255);

        button.on(Node.EventType.TOUCH_END, () => {
            if (!this.playerDead && !this.transitioning) action();
        }, this);

        return button;
    }

    private onEasyTouchStart(event: EventTouch) {
        if (this.playerDead || this.transitioning) return;
        this.joystickActive = true;
        this.updateEasyTouchVector(event);
    }

    private onEasyTouchMove(event: EventTouch) {
        if (!this.joystickActive) return;
        this.updateEasyTouchVector(event);
    }

    private updateEasyTouchVector(event: EventTouch) {
        if (!this.easyTouchNode || !this.easyTouchKnob) return;

        const point = event.getUILocation();
        const visible = view.getVisibleSize();
        const centerX = visible.width / 2 + this.easyTouchNode.position.x;
        const centerY = visible.height / 2 + this.easyTouchNode.position.y;

        let dx = point.x - centerX;
        let dy = point.y - centerY;

        const length = Math.sqrt(dx * dx + dy * dy);
        const maxOffset = 24;

        if (length > maxOffset) {
            dx = dx / length * maxOffset;
            dy = dy / length * maxOffset;
        }

        this.easyTouchKnob.setPosition(dx, dy, 0);

        const deadZone = 9;
        this.joystickDX = Math.abs(dx) < deadZone ? 0 : (dx > 0 ? 1 : -1);
        // UI truc Y huong len; grid Y am la huong len.
        this.joystickDY = Math.abs(dy) < deadZone ? 0 : (dy > 0 ? -1 : 1);
    }

    private onEasyTouchEnd() {
        this.joystickActive = false;
        this.joystickDX = 0;
        this.joystickDY = 0;
        if (this.easyTouchKnob) {
            this.easyTouchKnob.setPosition(0, 0, 0);
        }
    }

    private toggleAutoCombat() {
        this.autoCombat = !this.autoCombat;
        if (this.mobileAutoLabel) {
            this.mobileAutoLabel.string = this.autoCombat ? 'AUTO ON' : 'AUTO';
        }
        console.log('AUTO ' + (this.autoCombat ? 'BAT' : 'TAT'));
    }


    // C4.13: Hien thi HP, MP, EXP, hoi chieu va AUTO.
    private updateMobileStatus() {
        if (!this.mobileStatusLabel) return;

        if (!this.characterController) {
            this.mobileStatusLabel.string = 'DANG NAP NHAN VAT...';
            return;
        }

        const data = this.characterController.data;
        const expNeeded = this.characterController.getExpToNextLevel();

        const kText = this.skillCooldownRemaining > 0
            ? 'K: ' + this.skillCooldownRemaining.toFixed(1) + 's'
            : 'K: SAN SANG';

        const lText = this.swordSkillCooldownRemaining > 0
            ? 'L: ' + this.swordSkillCooldownRemaining.toFixed(1) + 's'
            : 'L: SAN SANG';

        const autoText = this.autoCombat ? 'AUTO: BAT' : 'AUTO: TAT';
        const deadText = this.playerDead ? ' | DA TU TRAN' : '';

        this.mobileStatusLabel.string =
            'HP ' + data.hp + '/' + data.maxHp +
            '   MP ' + data.mp + '/' + data.maxMp +
            '   EXP ' + data.exp + '/' + expNeeded +
            '   TUI ' + this.inventory.occupiedCount + '/60' +
            '\n' + kText + '   ' + lText + '   ' + autoText + deadText;
    }

    // C4.12: Dieu khien joystick va tu dong chien dau.
    private updateMobileControls(dt: number) {
        this.updateMobileStatus();

        if (this.playerDead || this.transitioning) return;

        if (this.joystickActive &&
            (this.joystickDX !== 0 || this.joystickDY !== 0)) {
            this.joystickMoveTimer -= dt;
            if (this.joystickMoveTimer <= 0) {
                this.movePlayer(this.joystickDX, this.joystickDY);
                this.joystickMoveTimer = 0.20;
            }
        } else {
            this.joystickMoveTimer = 0;
        }

        if (!this.autoCombat || !this.characterController || !this.mapData) {
            return;
        }

        this.autoCombatTimer -= dt;
        if (this.autoCombatTimer > 0) return;
        this.autoCombatTimer = 0.30;

        let nearest: MonsterController | null = null;
        let nearestDistance = 999;

        const player = this.characterController.data;
        for (const monster of this.monsterControllers) {
            if (!monster.isAlive) continue;

            const dx = monster.data.gridX - player.gridX;
            const dy = monster.data.gridY - player.gridY;
            const distance = Math.max(Math.abs(dx), Math.abs(dy));

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = monster;
            }
        }

        if (!nearest) return;

        const dx = nearest.data.gridX - player.gridX;
        const dy = nearest.data.gridY - player.gridY;

        // Huong nhan vat ve muc tieu de kiem khi co the chem trung.
        if (dx !== 0 || dy !== 0) {
            const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
            const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

            if (sx === 0 && sy < 0) this.characterController.direction = CharacterDirection.NORTH;
            else if (sx === 0 && sy > 0) this.characterController.direction = CharacterDirection.SOUTH;
            else if (sx < 0 && sy === 0) this.characterController.direction = CharacterDirection.WEST;
            else if (sx > 0 && sy === 0) this.characterController.direction = CharacterDirection.EAST;
            else if (sx < 0 && sy < 0) this.characterController.direction = CharacterDirection.NORTH_WEST;
            else if (sx > 0 && sy < 0) this.characterController.direction = CharacterDirection.NORTH_EAST;
            else if (sx < 0 && sy > 0) this.characterController.direction = CharacterDirection.SOUTH_WEST;
            else this.characterController.direction = CharacterDirection.SOUTH_EAST;
        }

        if (nearestDistance <= 1) {
            this.attackNearestMonster();
            if (this.skillCooldownRemaining <= 0) this.useAreaSkill();
            if (this.swordSkillCooldownRemaining <= 0) this.useSwordSkill();
        } else {
            this.movePlayer(
                dx === 0 ? 0 : (dx > 0 ? 1 : -1),
                dy === 0 ? 0 : (dy > 0 ? 1 : -1)
            );
        }
    }

    private onTouchStart(event: EventTouch) {
        const point = event.getUILocation();
        this.touchStartX = point.x;
        this.touchStartY = point.y;
        this.touchTracking = true;
    }

    private onTouchEnd(event: EventTouch) {
        if (!this.touchTracking) return;
        this.touchTracking = false;

        const point = event.getUILocation();
        const deltaX = point.x - this.touchStartX;
        const deltaY = point.y - this.touchStartY;
        const threshold = 25;

        if (Math.abs(deltaX) < threshold &&
            Math.abs(deltaY) < threshold) {
            return;
        }

        const dx = Math.abs(deltaX) >= threshold
            ? (deltaX > 0 ? 1 : -1) : 0;

        // UI coordinates increase upward.
        const dy = Math.abs(deltaY) >= threshold
            ? (deltaY > 0 ? -1 : 1) : 0;

        this.movePlayer(dx, dy);
    }

    private onKeyDown(event: EventKeyboard) {
        if (this.transitioning || this.playerDead) return;

        let dx = 0;
        let dy = 0;

        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.ARROW_UP:
                dy = -1;
                break;

            case KeyCode.KEY_S:
            case KeyCode.ARROW_DOWN:
                dy = 1;
                break;

            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                dx = -1;
                break;

            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                dx = 1;
                break;

            case KeyCode.KEY_K:
                this.useAreaSkill();
                return;

            case KeyCode.KEY_L:
                this.useSwordSkill();
                return;

            case KeyCode.SPACE:
            case KeyCode.KEY_J:
                this.attackNearestMonster();
                return;

        default:
                return;
        }

        this.movePlayer(dx, dy);
    }

    private movePlayer(dx: number, dy: number) {
        if (this.playerDead) return;
        if (!this.mapData) return;

        if (!this.characterController) return;

        if (this.inventory.isCompletelyFull) {
            console.log('Tui do da day 60/60 o. Khong the di chuyen!');
            return;
        }

        const result = this.characterController.move(
            this.mapData,
            dx,
            dy
        );

        if (!result.moved) {
            console.log('Khong di chuyen duoc:', result.reason);
            return;
        }

        this.gridX = result.gridX;
        this.gridY = result.gridY;
        this.walkAnimationRemaining = 0.22;

        this.updatePlayerPosition();
        this.followCamera();
        this.checkPortal();
    }

    private checkPortal() {
        if (!this.mapData || this.transitioning) return;

        const portal = this.mapData.portals.find(
            item => item.x === this.gridX &&
                    item.y === this.gridY
        );

        if (!portal) return;

        this.transitioning = true;
        // Ghi lai dung toa do roi khoi ban do de Tho Dia Phu quay ve.
        this.teleportation.saveReturnPoint(this.mapData, this.gridX, this.gridY);

        console.log('Dang chuyen ban do:', portal.id);

        MapTransition.loadTarget(
            this.mapData,
            portal.id,
            (error, result) => {
                if (error || !result) {
                    console.error('Chuyen ban do that bai:', error);
                    this.transitioning = false;
                    return;
                }

                this.mapData = result.mapData;
                this.gridX = result.spawnX;
                this.gridY = result.spawnY;
                this.characterController?.setMapSpawn(result.spawnX, result.spawnY);

                this.removeLayer('GroundTiles');
                this.removeLayer('ObstacleTiles');

                this.drawGround();
                this.drawObstacles();
            this.drawMonsters();

                this.updatePlayerPosition();
                this.followCamera();

                console.log(
                    'Da chuyen den map:',
                    result.mapData.map_id,
                    'tai:',
                    this.gridX,
                    this.gridY
                );

                this.transitioning = false;
            }
        );
    }

    private removeLayer(name: string) {
        const layer = this.node.getChildByName(name);

        if (layer) {
            layer.removeFromParent();
            layer.destroy();
        }
    }

    private createLayer(name: string): Graphics {
        const node = new Node(name);
        node.setParent(this.node);
        return node.addComponent(Graphics);
    }

    private drawDiamond(
        g: Graphics,
        x: number,
        y: number,
        color: Color
    ) {
        const p = IsometricGrid.gridToLocal(x, y);

        g.fillColor = color;
        g.moveTo(p.x, p.y + 16);
        g.lineTo(p.x + 32, p.y);
        g.lineTo(p.x, p.y - 16);
        g.lineTo(p.x - 32, p.y);
        g.close();
        g.fill();
    }

    private drawGround() {
        if (!this.mapData) return;

        const g = this.createLayer('GroundTiles');

        for (let y = 0; y < this.mapData.height; y++) {
            for (let x = 0; x < this.mapData.width; x++) {
                const color = (x + y) % 2 === 0
                    ? new Color(85, 135, 70, 255)
                    : new Color(98, 145, 78, 255);

                this.drawDiamond(g, x, y, color);
            }
        }
    }

    private drawObstacles() {
        if (!this.mapData) return;

        const g = this.createLayer('ObstacleTiles');

        for (const cell of this.mapData.blocked_cells) {
            this.drawDiamond(
                g,
                cell[0],
                cell[1],
                new Color(145, 65, 45, 255)
            );
        }
    }

    
    // C2: Tao va hien thi quai vat theo monster_spawns cua tung ban do.
    
    private attackNearestMonster() {
        if (this.playerDead) return;
        if (!this.characterController || !this.mapData) return;

        let nearestIndex = -1;
        let nearestDistance = 999;

        for (let i = 0; i < this.monsterControllers.length; i++) {
            const monster = this.monsterControllers[i];
            if (!monster.isAlive) continue;

            const dx = Math.abs(
                this.characterController.data.gridX - monster.data.gridX
            );
            const dy = Math.abs(
                this.characterController.data.gridY - monster.data.gridY
            );
            const distance = Math.max(dx, dy);

            if (distance <= 1 && distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        if (nearestIndex < 0) {
            console.log('Khong co quai vat trong tam danh.');
            return;
        }

        const monster = this.monsterControllers[nearestIndex];
        const result = CombatSystem.playerAttack(
            this.characterController,
            monster
        );

        console.log(result.message);

        // C4.6: Hien thi sat thuong tren dau quai.
        if (result.hit && result.damage > 0) {
            const damageNode = new Node('DamageNumber');
            damageNode.setParent(this.monsterNodes[nearestIndex]);
            damageNode.setPosition(0, 36, 0);

            const damageTransform = damageNode.addComponent(UITransform);
            damageTransform.setContentSize(80, 22);
            damageTransform.setAnchorPoint(0.5, 0.5);

            const damageLabel = damageNode.addComponent(Label);
            damageLabel.string = '-' + result.damage;
            damageLabel.fontSize = 14;
            damageLabel.lineHeight = 16;
            damageLabel.color = new Color(255, 75, 65, 255);

            // Xoa so sat thuong sau 0,55 giay.
            this.scheduleOnce(() => {
                if (damageNode.parent) {
                    damageNode.destroy();
                }
            }, 0.55);
        }

        const hpGraphics = this.monsterHpGraphics[nearestIndex];
        if (hpGraphics) {
            const ratio = monster.data.maxHp > 0
                ? Math.max(0, monster.data.hp / monster.data.maxHp)
                : 0;

            hpGraphics.clear();
            hpGraphics.fillColor = new Color(45, 25, 25, 230);
            hpGraphics.fillRect(-15, -2, 30, 4);
            hpGraphics.fillColor = ratio > 0.6
                ? new Color(65, 200, 90, 255)
                : ratio >= 0.3
                    ? new Color(235, 175, 45, 255)
                    : new Color(220, 55, 55, 255);
            hpGraphics.fillRect(-15, -2, 30 * ratio, 4);
        }

        if (result.defeated) {
            // C4.3-C4.5: Nhan EXP va phat hien tang cap.
            const expReward = monster.data.expReward;
            const oldLevel = this.characterController.data.level;
            const oldMaxHp = this.characterController.data.maxHp;
            const oldMaxMp = this.characterController.data.maxMp;

            const levelsGained = this.characterController.gainExp(expReward);

            console.log('Nhan +' + expReward + ' EXP');
            this.updatePlayerHud();

            if (levelsGained > 0) {
                this.showLevelUpNotice(oldLevel, oldMaxHp, oldMaxMp);
                console.log('Chuc mung! Nhan vat len cap ' +
                    this.characterController.data.level);
            }

            const node = this.monsterNodes[nearestIndex];

            // C4.8: Luu vi tri va ban do de hoi sinh dung cho.
            const respawnX = monster.data.gridX;
            const respawnY = monster.data.gridY;
            const respawnMapId = this.mapData.map_id;
            const respawnMonsterId =
                monster.data.id + '_respawn_' + Date.now();

            // Giu quai 0.6 giay de hien sat thuong cuoi.
            if (node) {
                this.scheduleOnce(() => {
                    if (node.parent) {
                        node.destroy();
                    }
                }, 0.6);
            }

            this.monsterControllers.splice(nearestIndex, 1);
            this.monsterNodes.splice(nearestIndex, 1);
            this.monsterHpGraphics.splice(nearestIndex, 1);
            this.monsterThinkTimers.delete(monster);
            this.monsterAttackTimers.delete(monster);

            console.log('Da tieu diet Slime!');

            // Hoi sinh sau 8 giay neu nguoi choi van o ban do cu.
            this.scheduleOnce(() => {
                if (!this.mapData ||
                    this.mapData.map_id !== respawnMapId) {
                    return;
                }

                this.spawnMonsterAt(
                    respawnMonsterId,
                    'Slime',
                    respawnX,
                    respawnY
                );

                console.log('Slime da hoi sinh tai:', respawnX, respawnY);
            }, 8);
        }
    }


    // C4.10: Ky nang danh lan kich hoat bang phim K.
    private useAreaSkill() {
        if (this.playerDead || this.transitioning) return;
        if (!this.characterController || !this.mapData) return;

        if (this.skillCooldownRemaining > 0) {
            console.log(
                'Ky nang dang hoi chieu: ' +
                this.skillCooldownRemaining.toFixed(1) + ' giay.'
            );
            return;
        }

        const player = this.characterController.data;
        const radius = 3;

        // Chi tinh quai con song trong pham vi danh lan.
        const targets: number[] = [];

        for (let i = 0; i < this.monsterControllers.length; i++) {
            const monster = this.monsterControllers[i];
            if (!monster.isAlive) continue;

            const dx = Math.abs(player.gridX - monster.data.gridX);
            const dy = Math.abs(player.gridY - monster.data.gridY);
            const distance = Math.max(dx, dy);

            if (distance <= radius) {
                targets.push(i);
            }
        }

        if (targets.length === 0) {
            console.log('Khong co quai vat trong pham vi ky nang.');
            return;
        }

        if (!this.characterController.useMana(20)) {
            console.log('Khong du MP! Can 20 MP de dung ky nang.');
            return;
        }

        this.skillCooldownRemaining = 5;

        const damage = 25 + player.level * 3;

        this.showAreaSkillEffect();

        console.log(
            'SU DUNG KY NANG DANH LAN! Sat thuong: ' +
            damage + ', so muc tieu: ' + targets.length
        );

        // Duyet nguoc de xoa quai ma khong lam sai chi so.
        for (let t = targets.length - 1; t >= 0; t--) {
            const index = targets[t];
            const monster = this.monsterControllers[index];
            if (!monster || !monster.isAlive) continue;

            monster.takeDamage(damage);
            this.showMonsterSkillDamage(index, damage);

            const hpGraphics = this.monsterHpGraphics[index];
            if (hpGraphics) {
                const ratio = monster.data.maxHp > 0
                    ? Math.max(0, monster.data.hp / monster.data.maxHp)
                    : 0;

                hpGraphics.clear();
                hpGraphics.fillColor = new Color(45, 25, 25, 230);
                hpGraphics.fillRect(-15, -2, 30, 4);
                hpGraphics.fillColor = ratio > 0.6
                ? new Color(65, 200, 90, 255)
                : ratio >= 0.3
                    ? new Color(235, 175, 45, 255)
                    : new Color(220, 55, 55, 255);
                hpGraphics.fillRect(-15, -2, 30 * ratio, 4);
            }

            if (monster.isAlive) continue;

            const expReward = monster.data.expReward;
            const oldLevel = this.characterController.data.level;
            const oldMaxHp = this.characterController.data.maxHp;
            const oldMaxMp = this.characterController.data.maxMp;
            const levelsGained =
                this.characterController.gainExp(expReward);

            console.log('Nhan +' + expReward + ' EXP tu ky nang.');

            if (levelsGained > 0) {
                this.showLevelUpNotice(oldLevel, oldMaxHp, oldMaxMp);
                console.log(
                    'Nhan vat len cap ' +
                    this.characterController.data.level
                );
            }

            // C4.14.2: Roi vat pham khi ky nang K ha quai.
            this.createMonsterDrop(
                monster.data.gridX,
                monster.data.gridY
            );

            const node = this.monsterNodes[index];
            const respawnX = monster.data.gridX;
            const respawnY = monster.data.gridY;
            const respawnMapId = this.mapData.map_id;
            const respawnId =
                monster.data.id + '_skill_respawn_' + Date.now();

            if (node) {
                this.scheduleOnce(() => {
                    if (node.isValid && node.parent) {
                        node.destroy();
                    }
                }, 0.6);
            }

            this.monsterControllers.splice(index, 1);
            this.monsterNodes.splice(index, 1);
            this.monsterHpGraphics.splice(index, 1);
            this.monsterThinkTimers.delete(monster);
            this.monsterAttackTimers.delete(monster);

            // Giu nguyen co che hoi sinh quai C4.8.
            this.scheduleOnce(() => {
                if (!this.mapData ||
                    this.mapData.map_id !== respawnMapId) {
                    return;
                }

                this.spawnMonsterAt(
                    respawnId,
                    'Slime',
                    respawnX,
                    respawnY
                );

                console.log(
                    'Slime hoi sinh tai:',
                    respawnX,
                    respawnY
                );
            }, 8);
        }

        this.updatePlayerHud();
    }

    // C4.10: Hieu ung vong nang luong quanh nhan vat.
    private showAreaSkillEffect() {
        if (!this.playerNode) return;

        const effectNode = new Node('AreaSkillEffect');
        effectNode.setParent(this.node);

        const pos = IsometricGrid.gridToLocal(this.gridX, this.gridY);
        effectNode.setPosition(pos.x, pos.y, 2);

        const graphics = effectNode.addComponent(Graphics);

        graphics.fillColor = new Color(70, 160, 255, 65);
        graphics.circle(0, 0, 68);
        graphics.fill();

        graphics.lineWidth = 4;
        graphics.strokeColor = new Color(110, 210, 255, 230);
        graphics.circle(0, 0, 68);
        graphics.stroke();

        graphics.lineWidth = 2;
        graphics.strokeColor = new Color(210, 245, 255, 220);
        graphics.circle(0, 0, 48);
        graphics.stroke();

        this.scheduleOnce(() => {
            if (effectNode.isValid && effectNode.parent) {
                effectNode.destroy();
            }
        }, 0.4);
    }

    // C4.10: Hien thi sat thuong ky nang tren tung quai.
    private showMonsterSkillDamage(index: number, damage: number) {
        const monsterNode = this.monsterNodes[index];
        if (!monsterNode || !monsterNode.isValid) return;

        const damageNode = new Node('SkillDamageNumber');
        damageNode.setParent(monsterNode);
        damageNode.setPosition(0, 42, 0);

        const transform = damageNode.addComponent(UITransform);
        transform.setContentSize(90, 24);
        transform.setAnchorPoint(0.5, 0.5);

        const label = damageNode.addComponent(Label);
        label.string = '-' + damage;
        label.fontSize = 17;
        label.lineHeight = 20;
        label.color = new Color(100, 210, 255, 255);

        this.scheduleOnce(() => {
            if (damageNode.isValid && damageNode.parent) {
                damageNode.destroy();
            }
        }, 0.7);
    }


    // C4.11: Lay vector huong chem theo 8 huong nhan vat.
    private getSwordSkillForward(): { x: number; y: number } {
        const direction = this.characterController!.direction;

        switch (direction) {
            case CharacterDirection.NORTH:
                return { x: 0, y: -1 };
            case CharacterDirection.SOUTH:
                return { x: 0, y: 1 };
            case CharacterDirection.WEST:
                return { x: -1, y: 0 };
            case CharacterDirection.EAST:
                return { x: 1, y: 0 };
            case CharacterDirection.NORTH_WEST:
                return { x: -1, y: -1 };
            case CharacterDirection.NORTH_EAST:
                return { x: 1, y: -1 };
            case CharacterDirection.SOUTH_WEST:
                return { x: -1, y: 1 };
            case CharacterDirection.SOUTH_EAST:
                return { x: 1, y: 1 };
            default:
                return { x: 0, y: 1 };
        }
    }

    // C4.11: Ky nang chem kiem khi hinh non bang phim L.
    private useSwordSkill() {
        if (this.playerDead || this.transitioning) return;
        if (!this.characterController || !this.mapData) return;

        if (this.swordSkillCooldownRemaining > 0) {
            console.log(
                'Kiem khi dang hoi chieu: ' +
                this.swordSkillCooldownRemaining.toFixed(1) +
                ' giay.'
            );
            return;
        }

        const player = this.characterController.data;
        const forward = this.getSwordSkillForward();
        const forwardLength = Math.sqrt(
            forward.x * forward.x + forward.y * forward.y
        );

        const maxRange = 3;
        const minCosAngle = Math.cos(50 * Math.PI / 180);
        const targets: number[] = [];

        // Hinh non 100 do, huong ve phia truoc nhan vat.
        for (let i = 0; i < this.monsterControllers.length; i++) {
            const monster = this.monsterControllers[i];
            if (!monster.isAlive) continue;

            const dx = monster.data.gridX - player.gridX;
            const dy = monster.data.gridY - player.gridY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= 0 || distance > maxRange) continue;

            const dot = dx * forward.x + dy * forward.y;
            const cosAngle = dot / (distance * forwardLength);

            if (dot > 0 && cosAngle >= minCosAngle) {
                targets.push(i);
            }
        }

        if (targets.length === 0) {
            console.log('Khong co quai vat trong vung chem kiem khi.');
            return;
        }

        if (!this.characterController.useMana(30)) {
            console.log('Khong du MP! Can 30 MP de dung kiem khi.');
            return;
        }

        this.swordSkillCooldownRemaining = 8;

        const damage = 45 + player.level * 5;

        this.showSwordSkillEffect(forward);

        console.log(
            'KIEM KHI! Sat thuong: ' + damage +
            ', so muc tieu: ' + targets.length
        );

        // Duyet nguoc de xoa quai an toan khi co nhieu muc tieu.
        for (let t = targets.length - 1; t >= 0; t--) {
            const index = targets[t];
            const monster = this.monsterControllers[index];

            if (!monster || !monster.isAlive) continue;

            monster.takeDamage(damage);
            this.showSwordSkillDamage(index, damage);

            const hpGraphics = this.monsterHpGraphics[index];

            if (hpGraphics) {
                const ratio = monster.data.maxHp > 0
                    ? Math.max(0, monster.data.hp / monster.data.maxHp)
                    : 0;

                hpGraphics.clear();
                hpGraphics.fillColor = new Color(45, 25, 25, 230);
                hpGraphics.fillRect(-15, -2, 30, 4);
                hpGraphics.fillColor = ratio > 0.6
                ? new Color(65, 200, 90, 255)
                : ratio >= 0.3
                    ? new Color(235, 175, 45, 255)
                    : new Color(220, 55, 55, 255);
                hpGraphics.fillRect(-15, -2, 30 * ratio, 4);
            }

            if (monster.isAlive) continue;

            // Nhan EXP va xu ly len cap theo he thong hien tai.
            const expReward = monster.data.expReward;
            const oldLevel = this.characterController.data.level;
            const oldMaxHp = this.characterController.data.maxHp;
            const oldMaxMp = this.characterController.data.maxMp;

            const levelsGained =
                this.characterController.gainExp(expReward);

            console.log('Nhan +' + expReward + ' EXP tu kiem khi.');

            if (levelsGained > 0) {
                this.showLevelUpNotice(oldLevel, oldMaxHp, oldMaxMp);
                console.log(
                    'Nhan vat len cap ' +
                    this.characterController.data.level
                );
            }

            // C4.14.2: Roi vat pham khi ky nang L ha quai.
            this.createMonsterDrop(
                monster.data.gridX,
                monster.data.gridY
            );

            const node = this.monsterNodes[index];
            const respawnX = monster.data.gridX;
            const respawnY = monster.data.gridY;
            const respawnMapId = this.mapData.map_id;
            const respawnId =
                monster.data.id + '_sword_respawn_' + Date.now();

            if (node) {
                this.scheduleOnce(() => {
                    if (node.isValid && node.parent) {
                        node.destroy();
                    }
                }, 0.6);
            }

            this.monsterControllers.splice(index, 1);
            this.monsterNodes.splice(index, 1);
            this.monsterHpGraphics.splice(index, 1);
            this.monsterThinkTimers.delete(monster);
            this.monsterAttackTimers.delete(monster);

            // Giu nguyen co che hoi sinh quai sau 8 giay.
            this.scheduleOnce(() => {
                if (!this.mapData ||
                    this.mapData.map_id !== respawnMapId) {
                    return;
                }

                this.spawnMonsterAt(
                    respawnId,
                    'Slime',
                    respawnX,
                    respawnY
                );

                console.log(
                    'Slime hoi sinh tai:',
                    respawnX,
                    respawnY
                );
            }, 8);
        }

        this.updatePlayerHud();
    }

    // C4.11: Hieu ung kiem khi mau vang theo huong chem.
    private showSwordSkillEffect(forward: { x: number; y: number }) {
        const effectNode = new Node('SwordSkillEffect');
        effectNode.setParent(this.node);

        const pos = IsometricGrid.gridToLocal(this.gridX, this.gridY);
        effectNode.setPosition(pos.x, pos.y, 2);

        const graphics = effectNode.addComponent(Graphics);

        // Chuyen huong luoi isometric sang huong hien thi tren man hinh.
        const localX = (forward.x - forward.y) * 32;
        const localY = -(forward.x + forward.y) * 16;
        const centerAngle = Math.atan2(localY, localX);
        const halfAngle = 50 * Math.PI / 180;
        const radius = 92;
        const segments = 12;

        graphics.moveTo(0, 0);

        for (let i = 0; i <= segments; i++) {
            const angle =
                centerAngle - halfAngle +
                (2 * halfAngle * i / segments);

            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            graphics.lineTo(x, y);
        }

        graphics.close();
        graphics.fillColor = new Color(255, 205, 45, 115);
        graphics.fill();

        graphics.lineWidth = 4;
        graphics.strokeColor = new Color(255, 235, 120, 245);
        graphics.moveTo(0, 0);

        for (let i = 0; i <= segments; i++) {
            const angle =
                centerAngle - halfAngle +
                (2 * halfAngle * i / segments);

            graphics.lineTo(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );
        }

        graphics.stroke();

        this.scheduleOnce(() => {
            if (effectNode.isValid && effectNode.parent) {
                effectNode.destroy();
            }
        }, 0.45);
    }

    // C4.11: Hien thi sat thuong kiem khi mau vang.
    private showSwordSkillDamage(index: number, damage: number) {
        const monsterNode = this.monsterNodes[index];
        if (!monsterNode || !monsterNode.isValid) return;

        const damageNode = new Node('SwordSkillDamage');
        damageNode.setParent(monsterNode);
        damageNode.setPosition(0, 48, 0);

        const transform = damageNode.addComponent(UITransform);
        transform.setContentSize(100, 26);
        transform.setAnchorPoint(0.5, 0.5);

        const label = damageNode.addComponent(Label);
        label.string = '-' + damage;
        label.fontSize = 19;
        label.lineHeight = 22;
        label.color = new Color(255, 215, 65, 255);

        this.scheduleOnce(() => {
            if (damageNode.isValid && damageNode.parent) {
                damageNode.destroy();
            }
        }, 0.75);
    }

    // C4.8: Tao lai quai vat va dat lai bo dem AI khi nap ban do.
    private drawMonsters() {
        if (!this.mapData) return;

        this.removeLayer('MonsterLayer');

        this.monsterControllers = [];
        this.monsterNodes = [];
        this.monsterHpGraphics = [];
        this.monsterThinkTimers.clear();
        this.monsterAttackTimers.clear();

        const layer = new Node('MonsterLayer');
        layer.setParent(this.node);

        const mapAny = this.mapData as any;
        const spawnGroups = mapAny.monster_spawns || [];
        const offsets = [
            [0, 0], [1, 0], [-1, 0],
            [0, 1], [0, -1], [1, 1],
            [-1, -1], [1, -1], [-1, 1]
        ];

        for (const spawn of spawnGroups) {
            const count = Math.max(0, Math.min(20, Number(spawn.count) || 0));

            for (let i = 0; i < count; i++) {
                const offset = offsets[i % offsets.length];
                const gx = Number(spawn.x) + offset[0];
                const gy = Number(spawn.y) + offset[1];

                if (
                    gx < 0 || gy < 0 ||
                    gx >= this.mapData.width ||
                    gy >= this.mapData.height ||
                    !MapDataLoader.isWalkable(this.mapData, gx, gy)
                ) continue;

                this.spawnMonsterAt(
                    String(spawn.monster_id || 'monster_slime_001') + '_' + i,
                    'Slime',
                    gx,
                    gy
                );
            }
        }
    }

    // C4.8: Ham tao mot quai vat, dung ca luc spawn va hoi sinh.
    private spawnMonsterAt(
        monsterId: string,
        monsterName: string,
        gx: number,
        gy: number
    ) {
        if (!this.mapData) return;

        const layer = this.node.getChildByName('MonsterLayer');
        if (!layer) return;

        if (
            gx < 0 || gy < 0 ||
            gx >= this.mapData.width ||
            gy >= this.mapData.height ||
            !MapDataLoader.isWalkable(this.mapData, gx, gy)
        ) return;

        const data = createMonster(monsterId, monsterName, gx, gy);
        const controller = new MonsterController(data);

        const monsterNode = new Node('Monster_' + data.id);
        monsterNode.setParent(layer);

        const pos = IsometricGrid.gridToLocal(gx, gy);
        monsterNode.setPosition(pos.x, pos.y, 1);

        const graphics = monsterNode.addComponent(Graphics);
        graphics.fillColor = new Color(35, 55, 35, 100);
        graphics.ellipse(0, -7, 13, 5);
        graphics.fill();

        graphics.fillColor = new Color(65, 205, 125, 255);
        graphics.ellipse(0, 1, 12, 10);
        graphics.fill();

        graphics.fillColor = new Color(155, 245, 185, 220);
        graphics.circle(-4, 5, 2);
        graphics.fill();

        graphics.fillColor = new Color(25, 45, 35, 255);
        graphics.circle(-4, 1, 1.3);
        graphics.fill();
        graphics.circle(4, 1, 1.3);
        graphics.fill();

        const labelNode = new Node('MonsterName');
        labelNode.setParent(monsterNode);
        labelNode.setPosition(0, 27, 0);
        labelNode.addComponent(UITransform).setContentSize(90, 18);

        const label = labelNode.addComponent(Label);
        label.string = monsterName + ' - Lv.' + data.level;
        label.fontSize = 10;
        label.lineHeight = 13;
        label.color = new Color(255, 225, 150, 255);

        const hpNode = new Node('MonsterHP');
        hpNode.setParent(monsterNode);
        hpNode.setPosition(0, 19, 0);

        const hpGraphics = hpNode.addComponent(Graphics);
        hpGraphics.fillColor = new Color(45, 25, 25, 230);
        hpGraphics.fillRect(-15, -2, 30, 4);
        hpGraphics.fillColor = new Color(65, 200, 90, 255);
        hpGraphics.fillRect(-15, -2, 30, 4);

        this.monsterControllers.push(controller);
        this.monsterNodes.push(monsterNode);
        this.monsterHpGraphics.push(hpGraphics);

        this.monsterThinkTimers.set(controller, 0);
        this.monsterAttackTimers.set(controller, 0);
    }



    // C4.14.2: Tao vat pham roi tai vi tri quai bi ha boi K hoac L.
    private createMonsterDrop(gx: number, gy: number) {
        const layer = this.node.getChildByName('LootLayer');
        if (!layer) {
            const newLayer = new Node('LootLayer');
            newLayer.setParent(this.node);
        }

        const lootLayer = this.node.getChildByName('LootLayer');
        if (!lootLayer) return;

        const id = 'slime_material_' + Date.now() + '_' +
            this.droppedItems.length;

        const data = createInventoryItem(
            id,
            'Manh Slime',
            'material',
            1,
            1
        );

        const dropNode = new Node('Loot_' + id);
        dropNode.setParent(lootLayer);

        const pos = IsometricGrid.gridToLocal(gx, gy);
        dropNode.setPosition(pos.x, pos.y, 2);
        dropNode.addComponent(UITransform).setContentSize(28, 28);

        const graphics = dropNode.addComponent(Graphics);
        graphics.fillColor = new Color(245, 205, 65, 235);
        graphics.circle(0, 0, 9);
        graphics.fill();
        graphics.lineWidth = 2;
        graphics.strokeColor = new Color(255, 245, 170, 255);
        graphics.circle(0, 0, 9);
        graphics.stroke();

        const labelNode = new Node('LootLabel');
        labelNode.setParent(dropNode);
        labelNode.setPosition(0, 17, 0);
        labelNode.addComponent(UITransform).setContentSize(65, 16);

        const label = labelNode.addComponent(Label);
        label.string = 'MANH';
        label.fontSize = 9;
        label.lineHeight = 12;
        label.color = new Color(255, 240, 160, 255);

        this.droppedItems.push({
            node: dropNode,
            gridX: gx,
            gridY: gy,
            data
        });

        console.log('Vat pham roi: Manh Slime tai', gx, gy);
    }

    // C4.14.2: Tu dong nhat vat pham khi dung cach toi da 1 o.
    private updateDroppedItems() {
        if (!this.characterController) return;

        const player = this.characterController.data;

        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const drop = this.droppedItems[i];

            const distance = Math.max(
                Math.abs(player.gridX - drop.gridX),
                Math.abs(player.gridY - drop.gridY)
            );

            if (distance > 1) continue;

            const result = this.inventory.tryAdd(drop.data);

            if (!result.success) {
                if (result.reason === 'inventory_full') {
                    console.log('Tui do da day. Khong the nhat vat pham.');
                }
                continue;
            }

            if (drop.node && drop.node.isValid) {
                drop.node.destroy();
            }

            this.droppedItems.splice(i, 1);
            this.refreshInventoryPanel();

            console.log(
                'Da nhat: ' + drop.data.name +
                ' (' + this.inventory.occupiedCount + '/60 o)'
            );
        }
    }

    // C4.14.3: Mo/dong bang tui do.
    private toggleInventoryPanel() {
        if (!this.inventoryPanel) return;

        this.inventoryVisible = !this.inventoryVisible;
        this.inventoryPanel.active = this.inventoryVisible;

        if (this.inventoryVisible) {
            this.refreshInventoryPanel();
        }
    }

    // C4.14.4: Tao bang tui do 10 cot x 6 hang.
    private createInventoryPanel(parent: Node) {
        const panel = new Node('InventoryPanel');
        panel.setParent(parent);
        panel.setPosition(0, 0, 0);
        panel.addComponent(UITransform).setContentSize(310, 310);

        const background = panel.addComponent(Graphics);
        background.fillColor = new Color(35, 28, 22, 245);
        background.roundRect(-155, -155, 310, 310, 10);
        background.fill();
        background.lineWidth = 2;
        background.strokeColor = new Color(205, 170, 105, 240);
        background.roundRect(-155, -155, 310, 310, 10);
        background.stroke();

        const titleNode = new Node('InventoryTitle');
        titleNode.setParent(panel);
        titleNode.setPosition(0, 132, 0);
        titleNode.addComponent(UITransform).setContentSize(280, 24);

        const title = titleNode.addComponent(Label);
        title.string = 'TUI DO - 6 COT x 10 HANG';
        title.fontSize = 16;
        title.lineHeight = 20;
        title.color = new Color(255, 220, 145, 255);

        this.inventoryCellNodes = [];

        const cellSize = 25;
        const startX = -62;
        const startY = 112;

        // Lưới túi đồ dọc: 6 cột x 10 hàng.
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 6; x++) {
                const cellX = x;
                const cellY = y;

                const cell = new Node(
                    'InventoryCell_' + x + '_' + y
                );
                cell.setParent(panel);
                cell.setPosition(
                    startX + x * cellSize,
                    startY - y * cellSize,
                    0
                );
                cell.addComponent(UITransform).setContentSize(23, 23);

                const graphics = cell.addComponent(Graphics);
                graphics.fillColor = new Color(85, 75, 62, 230);
                graphics.fillRect(-11, -11, 22, 22);
                graphics.lineWidth = 1;
                graphics.strokeColor = new Color(165, 145, 115, 220);
                graphics.rect(-11, -11, 22, 22);
                graphics.stroke();

                const textNode = new Node('CellText');
                textNode.setParent(cell);
                textNode.addComponent(UITransform).setContentSize(22, 20);

                const label = textNode.addComponent(Label);
                label.string = '';
                label.fontSize = 7;
                label.lineHeight = 9;
                label.color = new Color(255, 245, 205, 255);

                // Cham vao bat ky o nao cua vat pham de chon.
                cell.on(
                    Node.EventType.TOUCH_END,
                    () => this.selectInventoryCell(cellX, cellY),
                    this
                );

                this.inventoryCellNodes.push(cell);
            }
        }

        const countNode = new Node('InventoryCount');
        countNode.setParent(panel);
        countNode.setPosition(0, -66, 0);
        countNode.addComponent(UITransform).setContentSize(280, 20);

        this.inventoryCountLabel = countNode.addComponent(Label);
        this.inventoryCountLabel.string = '0/60 O';
        this.inventoryCountLabel.fontSize = 12;
        this.inventoryCountLabel.lineHeight = 16;
        this.inventoryCountLabel.color = new Color(255, 230, 180, 255);

        // Khu vuc hien thong tin vat pham dang chon.
        const detailNode = new Node('InventoryItemDetails');
        detailNode.setParent(panel);
        detailNode.setPosition(0, -96, 0);
        detailNode.addComponent(UITransform).setContentSize(290, 42);

        this.inventoryDetailLabel = detailNode.addComponent(Label);
        this.inventoryDetailLabel.string = 'Cham vao vat pham de xem thong tin';
        this.inventoryDetailLabel.fontSize = 10;
        this.inventoryDetailLabel.lineHeight = 13;
        this.inventoryDetailLabel.color = new Color(255, 240, 195, 255);
        this.inventoryDetailLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        // Nut bo vat pham dang chon.
        const discardButton = new Node('DiscardInventoryItemButton');
        discardButton.setParent(panel);
        discardButton.setPosition(-78, -132, 0);
        discardButton.addComponent(UITransform).setContentSize(145, 30);

        const discardGraphics = discardButton.addComponent(Graphics);
        discardGraphics.fillColor = new Color(145, 45, 35, 245);
        discardGraphics.roundRect(-72, -15, 144, 30, 5);
        discardGraphics.fill();
        discardGraphics.lineWidth = 1;
        discardGraphics.strokeColor = new Color(245, 185, 135, 230);
        discardGraphics.roundRect(-72, -15, 144, 30, 5);
        discardGraphics.stroke();

        const discardTextNode = new Node('DiscardButtonLabel');
        discardTextNode.setParent(discardButton);
        discardTextNode.addComponent(UITransform).setContentSize(140, 26);

        const discardLabel = discardTextNode.addComponent(Label);
        discardLabel.string = 'BO VAT PHAM';
        discardLabel.fontSize = 12;
        discardLabel.lineHeight = 16;
        discardLabel.color = new Color(255, 255, 255, 255);

        discardButton.on(
            Node.EventType.TOUCH_END,
            () => this.discardSelectedInventoryItem(),
            this
        );

        const useButton = new Node('UseInventoryItemButton');
        useButton.setParent(panel);
        useButton.setPosition(78, -132, 0);
        useButton.addComponent(UITransform).setContentSize(145, 30);
        const useGraphics = useButton.addComponent(Graphics);
        useGraphics.fillColor = new Color(55, 115, 75, 245);
        useGraphics.roundRect(-72, -15, 144, 30, 5);
        useGraphics.fill();
        useGraphics.lineWidth = 1;
        useGraphics.strokeColor = new Color(170, 225, 170, 230);
        useGraphics.roundRect(-72, -15, 144, 30, 5);
        useGraphics.stroke();
        const useTextNode = new Node('UseButtonLabel');
        useTextNode.setParent(useButton);
        useTextNode.addComponent(UITransform).setContentSize(140, 26);
        const useLabel = useTextNode.addComponent(Label);
        useLabel.string = 'SU DUNG BUA';
        useLabel.fontSize = 11;
        useLabel.lineHeight = 14;
        useLabel.color = new Color(255, 255, 255, 255);
        useButton.on(Node.EventType.TOUCH_END, () => this.useSelectedInventoryItem(), this);

        this.createTeleportPanel(parent);
        panel.active = false;
        this.inventoryPanel = panel;

        this.refreshInventoryPanel();
    }

    // C4.14.5: Bang chon diem den. Danh sach du 7 thanh + 14 dia danh.
    private createTeleportPanel(parent: Node) {
        const panel = new Node('TeleportDestinationPanel');
        panel.setParent(parent);
        panel.setPosition(0, 0, 0);
        panel.addComponent(UITransform).setContentSize(300, 220);
        const bg = panel.addComponent(Graphics);
        bg.fillColor = new Color(30, 27, 23, 250);
        bg.roundRect(-150, -110, 300, 220, 9); bg.fill();
        bg.lineWidth = 2; bg.strokeColor = new Color(220, 180, 105, 255);
        bg.roundRect(-150, -110, 300, 220, 9); bg.stroke();
        const titleNode = new Node('TeleportTitle'); titleNode.setParent(panel);
        titleNode.setPosition(0, 65, 0); titleNode.addComponent(UITransform).setContentSize(270, 22);
        const title = titleNode.addComponent(Label); title.string = 'THAN HANH PHU';
        title.fontSize = 15; title.lineHeight = 19; title.color = new Color(255, 220, 145, 255);
        const destNode = new Node('TeleportDestination'); destNode.setParent(panel);
        destNode.setPosition(0, 25, 0); destNode.addComponent(UITransform).setContentSize(270, 30);
        this.teleportDestinationLabel = destNode.addComponent(Label);
        this.teleportDestinationLabel.fontSize = 13; this.teleportDestinationLabel.lineHeight = 17;
        this.teleportDestinationLabel.color = new Color(255, 255, 225, 255);
        this.addTeleportPanelButton(panel, 'PREV', 'TRUOC', -90, -25, () => this.changeTeleportDestination(-1));
        this.addTeleportPanelButton(panel, 'NEXT', 'TIEP', 90, -25, () => this.changeTeleportDestination(1));
        this.addTeleportPanelButton(panel, 'CONFIRM', 'DICH CHUYEN', 0, -65, () => this.confirmTeleport());
        this.addTeleportPanelButton(panel, 'CANCEL', 'DONG', 0, -95, () => this.closeTeleportPanel());
        panel.active = false;
        this.teleportPanel = panel;
    }

    private addTeleportPanelButton(parent: Node, name: string, text: string,
        x: number, y: number, action: () => void) {
        const button = new Node('Teleport_' + name); button.setParent(parent);
        button.setPosition(x, y, 0); button.addComponent(UITransform).setContentSize(112, 28);
        const g = button.addComponent(Graphics); g.fillColor = new Color(95, 75, 48, 245);
        g.roundRect(-56, -14, 112, 28, 4); g.fill();
        g.lineWidth = 1; g.strokeColor = new Color(220, 185, 125, 255);
        g.roundRect(-56, -14, 112, 28, 4); g.stroke();
        const labelNode = new Node('Label'); labelNode.setParent(button);
        labelNode.addComponent(UITransform).setContentSize(108, 25);
        const label = labelNode.addComponent(Label); label.string = text;
        label.fontSize = 10; label.lineHeight = 13; label.color = new Color(255, 255, 255, 255);
        button.on(Node.EventType.TOUCH_END, action, this);
    }

    private changeTeleportDestination(delta: number) {
        const count = TELEPORT_DESTINATIONS.length;
        this.teleportDestinationIndex = (this.teleportDestinationIndex + delta + count) % count;
        this.refreshTeleportDestinationLabel();
    }

    private refreshTeleportDestinationLabel() {
        if (!this.teleportDestinationLabel) return;
        const destination = TELEPORT_DESTINATIONS[this.teleportDestinationIndex];
        this.teleportDestinationLabel.string = (this.teleportDestinationIndex + 1) + '/' +
            TELEPORT_DESTINATIONS.length + ' - ' + destination.name;
    }

    private openTeleportPanel(mode: 'travel' | 'return') {
        if (!this.teleportPanel) return;
        this.teleportPanelMode = mode;
        const title = this.teleportPanel.getChildByName('TeleportTitle')?.getComponent(Label);
        if (title) title.string = mode === 'travel' ? 'THAN HANH PHU - CHON NOI DEN' : 'THO DIA PHU - VE DIEM CU';
        this.teleportPanel.getChildByName('Teleport_PREV')!.active = mode === 'travel';
        this.teleportPanel.getChildByName('Teleport_NEXT')!.active = mode === 'travel';
        this.teleportPanel.getChildByName('Teleport_CONFIRM')!.active = true;
        this.teleportPanel.getChildByName('Teleport_CANCEL')!.active = true;
        this.refreshTeleportDestinationLabel();
        if (mode === 'return') {
            const saved = this.teleportation.getSavedReturnPoint();
            if (this.teleportDestinationLabel) this.teleportDestinationLabel.string = saved
                ? saved.mapName + ' (' + saved.x + ', ' + saved.y + ')'
                : 'Chua co diem tro ve duoc luu';
        }
        this.teleportPanel.active = true;
    }

    private closeTeleportPanel() {
        if (this.teleportPanel) this.teleportPanel.active = false;
    }

    private useSelectedInventoryItem() {
        if (!this.selectedInventoryItemId) { console.log('Hay chon vat pham truoc.'); return; }
        const entry = this.inventory.getItems().find(p => p.item.id === this.selectedInventoryItemId);
        if (!entry) return;
        if (entry.item.type === 'travel_talisman') this.openTeleportPanel('travel');
        else if (entry.item.type === 'return_talisman') this.openTeleportPanel('return');
        else console.log('Vat pham nay chua co chuc nang su dung.');
    }

    private confirmTeleport() {
        if (this.transitioning || this.playerDead || !this.mapData) return;
        const itemType = this.teleportPanelMode === 'travel' ? 'travel_talisman' : 'return_talisman';
        const entry = this.inventory.getItems().find(p => p.item.id === this.selectedInventoryItemId && p.item.type === itemType);
        if (!entry) { console.log('Khong tim thay dung loai bua trong tui.'); return; }
        let mapId = '';
        let targetX: number | null = null;
        let targetY: number | null = null;
        if (this.teleportPanelMode === 'travel') {
            const destination: TeleportDestination = TELEPORT_DESTINATIONS[this.teleportDestinationIndex];
            mapId = destination.mapId;
        } else {
            const saved = this.teleportation.getSavedReturnPoint();
            if (!saved) { console.log('Chua co diem tro ve. Bua duoc giu nguyen.'); return; }
            mapId = saved.mapId; targetX = saved.x; targetY = saved.y;
        }
        this.closeTeleportPanel();
        this.transitioning = true;
        // Delay dung 1 giay; chi tieu bua sau khi tai map va toa do thanh cong.
        this.scheduleOnce(() => {
            this.teleportation.loadMap(mapId, targetX, targetY, (error, map, x, y) => {
                if (error || !map || x === undefined || y === undefined) {
                    console.warn('Dich chuyen that bai:', error, '- Khong mat bua.');
                    this.transitioning = false;
                    return;
                }
                const oldMap = this.mapData;
                if (oldMap) this.teleportation.saveReturnPoint(oldMap, this.gridX, this.gridY);
                this.applyTeleportedMap(map, x, y);
                this.inventory.removeItem(entry.item.id);
                this.selectedInventoryItemId = null;
                this.refreshInventoryPanel();
                this.transitioning = false;
                console.log('Dich chuyen thanh cong den', map.name, x, y);
            });
        }, 1);
    }

    private applyTeleportedMap(map: MapDefinition, x: number, y: number) {
        this.mapData = map; this.gridX = x; this.gridY = y;
        this.characterController?.setMapSpawn(x, y);
        this.removeLayer('GroundTiles'); this.removeLayer('ObstacleTiles');
        this.drawGround(); this.drawObstacles(); this.drawMonsters();
        this.updatePlayerPosition(); this.followCamera();
    }

    // C4.14.4: Chon vat pham tu bat ky o nao no dang chiem.
    private selectInventoryCell(x: number, y: number) {
        const owner = this.inventory.getCellOwner(x, y);

        this.selectedInventoryItemId = owner;
        this.refreshInventoryPanel();

        if (!owner) {
            console.log('Khong co vat pham tai o nay.');
            return;
        }

        const placement = this.inventory.getItems().find(
            entry => entry.item.id === owner
        );

        if (placement) {
            console.log('Da chon vat pham:', placement.item.name);
        }
    }

    // C4.14.4: Bo vat pham dang chon khoi tui.
    private discardSelectedInventoryItem() {
        if (!this.selectedInventoryItemId) {
            console.log('Hay chon vat pham truoc khi bo.');
            return;
        }

        const placement = this.inventory.getItems().find(
            entry => entry.item.id === this.selectedInventoryItemId
        );

        if (!placement) {
            this.selectedInventoryItemId = null;
            this.refreshInventoryPanel();
            return;
        }

        const itemName = placement.item.name;
        const itemId = this.selectedInventoryItemId;

        if (!this.inventory.removeItem(itemId)) {
            console.log('Khong the bo vat pham:', itemName);
            return;
        }

        this.selectedInventoryItemId = null;
        this.refreshInventoryPanel();

        console.log(
            'Da bo vat pham: ' + itemName +
            '. Tui do con ' + this.inventory.occupiedCount + '/60 o.'
        );
    }

    // C4.14.4: Cap nhat thong tin vat pham dang chon.
    private updateInventoryItemDetails() {
        if (!this.inventoryDetailLabel) return;

        if (!this.selectedInventoryItemId) {
            this.inventoryDetailLabel.string =
                'Cham vao vat pham de xem thong tin';
            return;
        }

        const placement = this.inventory.getItems().find(
            entry => entry.item.id === this.selectedInventoryItemId
        );

        if (!placement) {
            this.selectedInventoryItemId = null;
            this.inventoryDetailLabel.string =
                'Cham vao vat pham de xem thong tin';
            return;
        }

        const item = placement.item;

        this.inventoryDetailLabel.string =
            item.name +
            '\nLoai: ' + item.type +
            ' | Cap: ' + item.level +
            '\nSo luong: ' + item.quantity +
            ' | Kich thuoc: ' + item.width + 'x' + item.height;
    }

    // C4.14.4: Ve lai vat pham theo dung kich thuoc va trang thai chon.
    private refreshInventoryPanel() {
        if (!this.inventoryPanel) return;

        const placements = this.inventory.getItems();

        for (let i = 0; i < this.inventoryCellNodes.length; i++) {
            const cell = this.inventoryCellNodes[i];
            const graphics = cell.getComponent(Graphics);
            const label = cell.getChildByName('CellText')
                ?.getComponent(Label);

            if (!graphics) continue;

            const x = i % 10;
            const y = Math.floor(i / 10);
            const owner = this.inventory.getCellOwner(x, y);

            graphics.clear();

            if (owner && owner === this.selectedInventoryItemId) {
                graphics.fillColor = new Color(225, 175, 65, 255);
            } else if (owner) {
                graphics.fillColor = new Color(145, 105, 55, 245);
            } else {
                graphics.fillColor = new Color(85, 75, 62, 230);
            }

            graphics.fillRect(-11, -11, 22, 22);
            graphics.lineWidth = 1;
            graphics.strokeColor = new Color(165, 145, 115, 220);
            graphics.rect(-11, -11, 22, 22);
            graphics.stroke();

            if (label) {
                const placement = placements.find(
                    entry => entry.item.id === owner &&
                        entry.x === x && entry.y === y
                );

                label.string = placement
                    ? placement.item.name.substring(0, 4).toUpperCase()
                    : '';
            }
        }

        if (this.inventoryCountLabel) {
            this.inventoryCountLabel.string =
                this.inventory.occupiedCount + '/60 O - CON ' +
                this.inventory.emptyCount + ' O';
        }

        this.updateInventoryItemDetails();
    }


    private createPlayer() {
        this.playerNode = new Node('PlayerStartMarker');
        this.playerNode.setParent(this.node);

        this.playerGraphics = this.playerNode.addComponent(Graphics);

        if (this.characterController) {
            CharacterAnimation.draw(
                this.playerGraphics,
                this.characterController.direction,
                0,
                false
            );
        }

        // Tao lop giao dien tren dau nhan vat.
        const hudNode = new Node('PlayerHUD');
        hudNode.setParent(this.playerNode);

        this.playerHudGraphics = hudNode.addComponent(Graphics);

        const nameNode = new Node('PlayerNameLevel');
        nameNode.setParent(hudNode);
        nameNode.setPosition(0, 54, 0);

        const transform = nameNode.addComponent(UITransform);
        transform.setContentSize(140, 20);
        transform.setAnchorPoint(0.5, 0.5);

        this.playerNameLabel = nameNode.addComponent(Label);
        this.playerNameLabel.string = 'Vo Lam - Lv.1';
        this.playerNameLabel.fontSize = 10;
        this.playerNameLabel.lineHeight = 14;
        this.playerNameLabel.color = new Color(255, 235, 170, 255);

        // C4.4: Hien thi EXP hien tai va EXP can de len cap.
        const expNode = new Node('PlayerExpLabel');
        expNode.setParent(hudNode);
        expNode.setPosition(0, 15, 0);
        const expTransform = expNode.addComponent(UITransform);
        expTransform.setContentSize(100, 14);
        expTransform.setAnchorPoint(0.5, 0.5);
        this.playerExpLabel = expNode.addComponent(Label);
        this.playerExpLabel.fontSize = 9;
        this.playerExpLabel.lineHeight = 12;
        this.playerExpLabel.color = new Color(255, 225, 150, 255);

        // C4.5: Label thong bao khi nhan vat len cap.
        const levelUpNode = new Node('LevelUpNotice');
        levelUpNode.setParent(hudNode);
        levelUpNode.setPosition(0, 82, 0);
        const levelUpTransform = levelUpNode.addComponent(UITransform);
        levelUpTransform.setContentSize(240, 48);
        levelUpTransform.setAnchorPoint(0.5, 0.5);
        this.levelUpLabel = levelUpNode.addComponent(Label);
        this.levelUpLabel.fontSize = 12;
        this.levelUpLabel.lineHeight = 15;
        this.levelUpLabel.color = new Color(255, 220, 90, 255);
        this.levelUpLabel.string = '';
        levelUpNode.active = false;

        this.updatePlayerHud();
        this.updatePlayerPosition();
    }

    // C4.5: Hien thong bao khi nhan vat tang cap.
    private showLevelUpNotice(oldLevel: number, oldMaxHp: number, oldMaxMp: number) {
        if (!this.levelUpLabel || !this.characterController) return;

        const data = this.characterController.data;
        const hpIncrease = data.maxHp - oldMaxHp;
        const mpIncrease = data.maxMp - oldMaxMp;

        this.levelUpLabel.string =
            'CHUC MUNG! LEN CAP ' + data.level + '\n' +
            'Cap do: ' + oldLevel + ' -> ' + data.level + '\n' +
            'MaxHP +' + hpIncrease + ' | MaxMP +' + mpIncrease;
        this.levelUpLabel.node.active = true;

        this.scheduleOnce(() => {
            if (this.levelUpLabel) {
                this.levelUpLabel.node.active = false;
            }
        }, 3);
    }

    // C4.9: Xu ly nhan vat tu tran.
    private handlePlayerDeath() {
        if (this.playerDead || !this.characterController) return;

        this.playerDead = true;
        console.log('Nhan vat da tu tran! Se hoi sinh sau 5 giay.');

        const currentMapId = this.mapData?.map_id;
        const spawn = this.mapData?.spawn_points.find(
            item => item.type === 'player'
        );

        const respawnX = spawn ? spawn.x : this.gridX;
        const respawnY = spawn ? spawn.y : this.gridY;

        this.scheduleOnce(() => {
            if (!this.characterController) return;

            // Neu ban do van la ban do luc tu tran, hoi sinh tai diem spawn.
            if (this.mapData?.map_id === currentMapId) {
                this.characterController.setMapSpawn(respawnX, respawnY);
                this.gridX = respawnX;
                this.gridY = respawnY;
            } else if (this.mapData) {
                // Neu ban do da thay doi, dung diem spawn cua ban do hien tai.
                const currentSpawn = this.mapData.spawn_points.find(
                    item => item.type === 'player'
                );

                if (currentSpawn) {
                    this.characterController.setMapSpawn(
                        currentSpawn.x,
                        currentSpawn.y
                    );
                    this.gridX = currentSpawn.x;
                    this.gridY = currentSpawn.y;
                }
            }

            const data = this.characterController.data;
            this.characterController.heal(data.maxHp);
            this.characterController.restoreMana(data.maxMp);

            this.playerDead = false;
            this.walkAnimationRemaining = 0;

            this.updatePlayerPosition();
            this.followCamera();
            this.updatePlayerHud();

            console.log('Nhan vat da hoi sinh. HP va MP da hoi phuc.');
        }, 5);
    }

    // C4.7: Quai vat ap sat va tan cong nhan vat.
    private updateMonsterAI(dt: number) {
        if (!this.characterController || !this.mapData) return;
        if (this.characterController.data.hp <= 0) return;

        for (const monster of this.monsterControllers) {
            if (!monster.isAlive) continue;

            const attackLeft = Math.max(
                0,
                (this.monsterAttackTimers.get(monster) || 0) - dt
            );
            this.monsterAttackTimers.set(monster, attackLeft);

            const thinkLeft = Math.max(
                0,
                (this.monsterThinkTimers.get(monster) || 0) - dt
            );

            if (thinkLeft > 0) {
                this.monsterThinkTimers.set(monster, thinkLeft);
                continue;
            }

            // Khong cho quai di chuyen moi frame.
            this.monsterThinkTimers.set(monster, 0.35);

            const action = MonsterAI.update(
                monster,
                this.characterController,
                this.mapData
            );

            if (action === 'move') {
                const index = this.monsterControllers.indexOf(monster);
                const node = this.monsterNodes[index];

                if (node) {
                    const pos = IsometricGrid.gridToLocal(
                        monster.data.gridX,
                        monster.data.gridY
                    );
                    node.setPosition(pos.x, pos.y, 1);
                }
            }

            if (action === 'attack' && attackLeft <= 0) {
                const damage = CombatSystem.monsterAttack(
                    monster,
                    this.characterController
                );

                if (damage > 0) {
                    this.monsterAttackTimers.set(monster, 1.25);
                    this.showPlayerDamage(damage);
                    this.updatePlayerHud();

                    console.log('Nhan vat nhan ' + damage + ' sat thuong.');
                }
            }
        }
    }

    // Hien thi so sat thuong mau do tren dau nhan vat.
    private showPlayerDamage(damage: number) {
        if (!this.playerNode || damage <= 0) return;

        const damageNode = new Node('PlayerDamageReceived');
        damageNode.setParent(this.playerNode);
        damageNode.setPosition(0, 58, 0);

        const transform = damageNode.addComponent(UITransform);
        transform.setContentSize(100, 24);
        transform.setAnchorPoint(0.5, 0.5);

        const label = damageNode.addComponent(Label);
        label.string = '-' + damage;
        label.fontSize = 16;
        label.lineHeight = 19;
        label.color = new Color(255, 65, 65, 255);

        this.scheduleOnce(() => {
            if (damageNode.isValid) {
                damageNode.destroy();
            }
        }, 0.7);
    }

    private updatePlayerHud() {
        if (!this.playerHudGraphics || !this.characterController) return;

        const data = this.characterController.data;
        const g = this.playerHudGraphics;
        g.clear();

        if (this.playerNameLabel) {
            this.playerNameLabel.string =
                data.name + ' - Lv.' + data.level;
        }

        const barWidth = 42;
        const barHeight = 5;
        const left = -barWidth / 2;

        const hpRatio = data.maxHp > 0
            ? Math.max(0, Math.min(1, data.hp / data.maxHp))
            : 0;

        const mpRatio = data.maxMp > 0
            ? Math.max(0, Math.min(1, data.mp / data.maxMp))
            : 0;

        // Nen thanh HP.
        g.fillColor = new Color(45, 25, 25, 230);
        g.fillRect(left, 35, barWidth, barHeight);

        // Thanh HP.
        g.fillColor = new Color(45, 205, 75, 255);
        g.fillRect(left, 35, barWidth * hpRatio, barHeight);

        // Nen thanh MP.
        g.fillColor = new Color(20, 35, 65, 230);
        g.fillRect(left, 27, barWidth, barHeight);

        // Thanh MP.
        g.fillColor = new Color(55, 145, 245, 255);
        g.fillRect(left, 27, barWidth * mpRatio, barHeight);

        // C4.4: Cap nhat chu EXP va thanh tien trinh EXP.
        const expNeeded = this.characterController.getExpToNextLevel();
        const expCurrent = Math.max(0, data.exp);
        const expRatio = expNeeded > 0
            ? Math.max(0, Math.min(1, expCurrent / expNeeded))
            : 0;

        if (this.playerExpLabel) {
            this.playerExpLabel.string = expCurrent + ' / ' + expNeeded + ' EXP';
        }

        g.fillColor = new Color(35, 30, 20, 230);
        g.fillRect(left, 7, barWidth, 4);
        g.fillColor = new Color(235, 175, 45, 255);
        g.fillRect(left, 7, barWidth * expRatio, 4);
    }

    private updatePlayerPosition() {
        if (!this.playerNode) return;

        const p = IsometricGrid.gridToLocal(
            this.gridX,
            this.gridY
        );

        this.playerNode.setPosition(p.x, p.y, 0);
    }

    private followCamera() {
        if (
            !this.cameraNode ||
            !this.playerNode ||
            !this.mapData
        ) return;

        MapCameraBounds.clamp(
            this.cameraNode,
            this.playerNode,
            this.mapData.width,
            this.mapData.height,
            this.viewWidth,
            this.viewHeight
        );
    }
}

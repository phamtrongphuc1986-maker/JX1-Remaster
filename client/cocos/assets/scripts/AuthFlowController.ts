import {
    _decorator, BlockInputEvents, Color, Component, EditBox, Graphics,
    Label, Node, UITransform, view
} from 'cc';
import { GameApi, ApiClass, ApiCharacter } from './network/GameApi';

const { ccclass, property } = _decorator;

type Screen = 'login' | 'classes' | 'create' | 'characters' | 'game';

@ccclass('AuthFlowController')
export class AuthFlowController extends Component {
    @property({ tooltip: 'URL API HTTPS của server. Để trống cho đến khi có máy chủ staging an toàn.' })
    apiBaseUrl = '';

    private api!: GameApi;
    private screen: Screen = 'login';
    private username = '';
    private password = '';
    private characterName = '';
    private selectedClass: ApiClass | null = null;
    private selectedCharacter: ApiCharacter | null = null;
    private classes: ApiClass[] = [];
    private characters: ApiCharacter[] = [];
    private statusLabel: Label | null = null;
    private contentRoot: Node | null = null;
    private panelWidth = 340;
    private panelHeight = 560;

    start(): void {
        this.api = new GameApi(this.apiBaseUrl);
        const visible = view.getVisibleSize();
        this.panelWidth = Math.max(280, Math.min(520, visible.width - 28));
        this.panelHeight = Math.max(440, Math.min(650, visible.height - 32));
        this.renderLogin();
    }

    private clearScreen(title: string, subtitle: string): Node {
        if (this.contentRoot?.isValid) this.contentRoot.destroy();
        const root = new Node('AuthFlow');
        root.setParent(this.node);
        const transform = root.addComponent(UITransform);
        transform.setContentSize(view.getVisibleSize());

        const panel = this.makePanel(root, this.panelWidth, this.panelHeight, 0, 0, new Color(13, 22, 34, 238));
        this.addLabel(panel, 'CUONG CHIEN ONLINE', 0, this.panelHeight / 2 - 42, this.panelWidth - 24, 34, 25, new Color(235, 194, 112));
        this.addLabel(panel, title, 0, this.panelHeight / 2 - 86, this.panelWidth - 28, 30, 21, Color.WHITE);
        this.addLabel(panel, subtitle, 0, this.panelHeight / 2 - 116, this.panelWidth - 30, 36, 12, new Color(190, 202, 216));
        this.statusLabel = this.addLabel(panel, '', 0, -this.panelHeight / 2 + 35, this.panelWidth - 28, 48, 12, new Color(255, 185, 120));
        this.contentRoot = root;
        return panel;
    }

    private makePanel(parent: Node, width: number, height: number, x: number, y: number, color: Color): Node {
        const node = new Node('Panel');
        node.setParent(parent);
        node.setPosition(x, y, 0);
        const ui = node.addComponent(UITransform);
        ui.setContentSize(width, height);
        node.addComponent(BlockInputEvents);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.roundRect(-width / 2, -height / 2, width, height, 16);
        graphics.fill();
        graphics.lineWidth = 2;
        graphics.strokeColor = new Color(177, 137, 75, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, 16);
        graphics.stroke();
        return node;
    }

    private addLabel(parent: Node, value: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        node.setParent(parent);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.string = value;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 5;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private addButton(parent: Node, value: string, x: number, y: number, width: number, height: number, action: () => void, primary = false): Node {
        const node = new Node('Button_' + value.replace(/[^a-zA-Z0-9]/g, '_'));
        node.setParent(parent);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = primary ? new Color(139, 91, 39, 255) : new Color(37, 57, 78, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.fill();
        graphics.lineWidth = 1;
        graphics.strokeColor = new Color(205, 168, 104, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, 8);
        graphics.stroke();
        this.addLabel(node, value, 0, 0, width - 12, height - 4, 15, Color.WHITE);
        node.on(Node.EventType.TOUCH_END, action, this);
        return node;
    }

    private addInput(parent: Node, placeholder: string, x: number, y: number, width: number, initial = '', password = false): EditBox {
        const node = new Node('Input_' + placeholder);
        node.setParent(parent);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, 44);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(241, 241, 235, 255);
        graphics.roundRect(-width / 2, -22, width, 44, 6);
        graphics.fill();

        const textNode = new Node('Text');
        textNode.setParent(node);
        textNode.addComponent(UITransform).setContentSize(width - 18, 38);
        const textLabel = textNode.addComponent(Label);
        textLabel.fontSize = 16;
        textLabel.color = new Color(30, 38, 46, 255);
        textLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        textLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const placeholderNode = new Node('Placeholder');
        placeholderNode.setParent(node);
        placeholderNode.addComponent(UITransform).setContentSize(width - 18, 38);
        const placeholderLabel = placeholderNode.addComponent(Label);
        placeholderLabel.string = placeholder;
        placeholderLabel.fontSize = 14;
        placeholderLabel.color = new Color(105, 112, 120, 255);
        placeholderLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        placeholderLabel.verticalAlign = Label.VerticalAlign.CENTER;

        const edit = node.addComponent(EditBox);
        edit.textLabel = textLabel;
        edit.placeholderLabel = placeholderLabel;
        edit.string = initial;
        edit.maxLength = 72;
        if (password) edit.inputFlag = EditBox.InputFlag.PASSWORD;
        edit.inputMode = EditBox.InputMode.SINGLE_LINE;
        return edit;
    }

    private setStatus(message: string): void {
        if (this.statusLabel?.isValid) this.statusLabel.string = message;
    }

    private renderLogin(): void {
        this.screen = 'login';
        const panel = this.clearScreen('Đăng nhập tài khoản', 'Đăng nhập để quản lý nhân vật trên máy chủ');
        const width = this.panelWidth - 48;
        const user = this.addInput(panel, 'Tên tài khoản (4-24 ký tự)', 0, 92, width, this.username);
        const pass = this.addInput(panel, 'Mật khẩu (ít nhất 8 ký tự)', 0, 34, width, this.password, true);
        user.node.on(EditBox.EventType.TEXT_CHANGED, () => { this.username = user.string.trim(); });
        pass.node.on(EditBox.EventType.TEXT_CHANGED, () => { this.password = pass.string; });
        const buttonWidth = Math.min(230, width);
        this.addButton(panel, 'ĐĂNG NHẬP', 0, -42, buttonWidth, 48, () => {
            this.username = user.string.trim();
            this.password = pass.string;
            void this.login();
        }, true);
        this.addButton(panel, 'TẠO TÀI KHOẢN MỚI', 0, -101, buttonWidth, 44, () => {
            this.username = user.string.trim();
            this.password = pass.string;
            void this.register();
        });
        this.addLabel(panel, 'Tài khoản: 4-24 ký tự • Mật khẩu: 8-72 ký tự', 0, -160, width, 38, 11, new Color(192, 199, 207));
        if (!this.apiBaseUrl.trim()) this.setStatus('Chưa cấu hình URL API. Chưa thể đăng nhập thật.');
    }

    private async login(): Promise<void> {
        if (!this.username || !this.password) {
            this.setStatus('Vui lòng nhập tên tài khoản và mật khẩu.');
            return;
        }
        this.setStatus('Đang kết nối máy chủ...');
        const result = await this.api.login(this.username, this.password);
        if (!result.ok) {
            this.setStatus(result.error || 'Đăng nhập thất bại.');
            return;
        }
        await this.loadClasses();
        await this.loadCharacters();
    }

    private async register(): Promise<void> {
        if (this.username.length < 4 || this.username.length > 24 || this.password.length < 8 || this.password.length > 72) {
            this.setStatus('Tên tài khoản 4-24 ký tự, mật khẩu 8-72 ký tự.');
            return;
        }
        this.setStatus('Đang tạo tài khoản...');
        const result = await this.api.register(this.username, this.password);
        if (!result.ok) {
            this.setStatus(result.error || 'Không thể tạo tài khoản.');
            return;
        }
        this.setStatus('Tạo tài khoản thành công. Đang đăng nhập...');
        await this.login();
    }

    private async loadClasses(): Promise<void> {
        const result = await this.api.listClasses();
        if (!result.ok || !result.data?.classes) {
            this.setStatus(result.error || 'Không tải được danh sách môn phái.');
            return;
        }
        this.classes = result.data.classes;
    }

    private async loadCharacters(): Promise<void> {
        const result = await this.api.listCharacters();
        if (!result.ok || !result.data?.characters) {
            this.setStatus(result.error || 'Không tải được danh sách nhân vật.');
            return;
        }
        this.characters = result.data.characters;
        if (this.characters.length > 0) this.renderCharacters();
        else this.renderClasses();
    }

    private renderClasses(): void {
        this.screen = 'classes';
        const panel = this.clearScreen('Chọn môn phái', 'Chọn một trong mười môn phái để tạo nhân vật');
        const gap = 8;
        const colWidth = (this.panelWidth - 52) / 2;
        const startY = this.panelHeight / 2 - 166;
        this.classes.forEach((item, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            this.addButton(panel, item.name, col === 0 ? -colWidth / 2 - gap / 2 : colWidth / 2 + gap / 2,
                startY - row * 54, colWidth, 44, () => {
                    this.selectedClass = item;
                    this.renderCreateCharacter();
                });
        });
        this.addButton(panel, 'ĐĂNG XUẤT', 0, -this.panelHeight / 2 + 94, 170, 40, () => this.logout());
    }

    private renderCreateCharacter(): void {
        this.screen = 'create';
        const panel = this.clearScreen('Tạo nhân vật', 'Môn phái: ' + (this.selectedClass?.name || 'Chưa chọn'));
        const width = this.panelWidth - 48;
        const name = this.addInput(panel, 'Tên nhân vật (2-16 ký tự)', 0, 68, width, this.characterName);
        name.node.on(EditBox.EventType.TEXT_CHANGED, () => { this.characterName = name.string.trim(); });
        this.addButton(panel, 'TẠO NHÂN VẬT', 0, -10, Math.min(230, width), 48, () => {
            this.characterName = name.string.trim();
            void this.createCharacter();
        }, true);
        this.addButton(panel, 'QUAY LẠI', 0, -70, 170, 42, () => this.renderClasses());
    }

    private async createCharacter(): Promise<void> {
        if (!this.selectedClass) {
            this.setStatus('Hãy chọn môn phái trước.');
            return;
        }
        if ([...this.characterName].length < 2 || [...this.characterName].length > 16) {
            this.setStatus('Tên nhân vật phải từ 2-16 ký tự.');
            return;
        }
        this.setStatus('Đang tạo nhân vật...');
        const result = await this.api.createCharacter(this.characterName, this.selectedClass.id);
        if (!result.ok || !result.data) {
            this.setStatus(result.error || 'Tạo nhân vật thất bại.');
            return;
        }
        this.characters.push(result.data);
        this.selectedCharacter = result.data;
        this.renderCharacters();
    }

    private renderCharacters(): void {
        this.screen = 'characters';
        const panel = this.clearScreen('Chọn nhân vật', 'Chọn nhân vật để vào bản đồ');
        const listTop = this.panelHeight / 2 - 160;
        if (!this.selectedCharacter && this.characters.length > 0) this.selectedCharacter = this.characters[0];
        const visibleCount = Math.min(this.characters.length, 5);
        for (let i = 0; i < visibleCount; i++) {
            const character = this.characters[i];
            const selected = this.selectedCharacter?.id === character.id;
            this.addButton(panel, character.name + '  •  ' + character.class_name + '  •  Cấp ' + character.level,
                0, listTop - i * 54, this.panelWidth - 48, 44, () => {
                    this.selectedCharacter = character;
                    this.renderCharacters();
                }, selected);
        }
        this.addButton(panel, 'VÀO GAME', 0, -this.panelHeight / 2 + 132, 210, 48, () => this.enterGame(), true);
        this.addButton(panel, 'TẠO NHÂN VẬT KHÁC', 0, -this.panelHeight / 2 + 76, 210, 42, () => this.renderClasses());
        this.addButton(panel, 'ĐĂNG XUẤT', 0, -this.panelHeight / 2 + 24, 150, 36, () => this.logout());
        if (this.characters.length > 5) this.setStatus('Đang hiển thị 5 nhân vật đầu tiên. Cần bổ sung cuộn danh sách ở bước UI tiếp theo.');
    }

    private enterGame(): void {
        if (!this.selectedCharacter) {
            this.setStatus('Hãy chọn một nhân vật.');
            return;
        }
        this.screen = 'game';
        const character = this.selectedCharacter;
        const panel = this.clearScreen('Đã chọn nhân vật', 'Kết nối REST thành công • Bản đồ đang ở chế độ thử nghiệm');
        this.addLabel(panel, character.name, 0, 72, this.panelWidth - 40, 42, 25, new Color(235, 194, 112));
        this.addLabel(panel, character.class_name + '  •  Cấp ' + character.level, 0, 30, this.panelWidth - 40, 32, 17, Color.WHITE);
        this.addLabel(panel, 'Nhân vật đã được chọn. Đồng bộ vị trí, quái vật và chiến đấu nhiều người chơi chưa được bật.', 0, -34, this.panelWidth - 54, 84, 13, new Color(195, 205, 215));
        this.addButton(panel, 'CHỌN NHÂN VẬT KHÁC', 0, -116, 220, 44, () => this.renderCharacters());
        this.addButton(panel, 'ĐĂNG XUẤT', 0, -172, 150, 40, () => this.logout());
    }

    private logout(): void {
        this.api.clearToken();
        this.username = '';
        this.password = '';
        this.selectedCharacter = null;
        this.renderLogin();
    }
}

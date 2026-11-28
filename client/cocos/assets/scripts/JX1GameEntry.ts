import { _decorator, Camera, Canvas, Color, Component, Node, UITransform, view } from 'cc';
import { AuthFlowController } from './AuthFlowController';
import { MapTestScene } from './MapTestScene';

const { ccclass, property } = _decorator;

/**
 * Runtime bootstrap for the map prototype and account/character UI.
 * Attach this component to the root node of the Editor-created Main.scene.
 */
@ccclass('JX1GameEntry')
export class JX1GameEntry extends Component {
    @property
    orthographicHeight = 225;

    start(): void {
        const cameraNode = new Node('MainCamera');
        cameraNode.setParent(this.node);
        cameraNode.setPosition(0, 0, 1000);

        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = this.orthographicHeight;
        camera.clearColor = new Color(18, 25, 34, 255);

        const visible = view.getVisibleSize();
        const worldNode = new Node('World');
        worldNode.setParent(this.node);

        const mapScene = worldNode.addComponent(MapTestScene);
        mapScene.cameraNode = cameraNode;
        mapScene.viewWidth = visible.width;
        mapScene.viewHeight = visible.height;

        const canvasNode = new Node('Canvas');
        canvasNode.setParent(this.node);
        canvasNode.layer = 1 << 25;
        canvasNode.addComponent(UITransform).setContentSize(visible.width, visible.height);
        const canvas = canvasNode.addComponent(Canvas);
        canvas.cameraComponent = camera;
        canvasNode.addComponent(AuthFlowController);

        console.info('[JX1] Map prototype and account/character flow initialized.');
    }
}

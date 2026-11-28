import { _decorator, Camera, Color, Component, Node, view } from 'cc';
import { MapTestScene } from './MapTestScene';

const { ccclass, property } = _decorator;

/**
 * Entry component for an empty Cocos Creator scene.
 * Attach this component to the Scene root node in the Editor.
 * It creates the orthographic camera and the prototype map world at runtime.
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

        const worldNode = new Node('World');
        worldNode.setParent(this.node);

        const mapScene = worldNode.addComponent(MapTestScene);
        mapScene.cameraNode = cameraNode;

        const visible = view.getVisibleSize();
        mapScene.viewWidth = visible.width;
        mapScene.viewHeight = visible.height;

        console.info('[JX1] Scene bootstrap completed. Loading test map...');
    }
}

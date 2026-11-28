import { Graphics, Color } from 'cc';
import { CharacterDirection } from './CharacterDirection';

export class CharacterAnimation {
    static draw(
        g: Graphics,
        direction: CharacterDirection,
        phase: number,
        moving: boolean
    ): void {
        g.clear();

        const bob = moving ? Math.sin(phase * 14) * 2.5 : Math.sin(phase * 2) * 0.8;
        const headX =
            direction === CharacterDirection.WEST ||
            direction === CharacterDirection.NORTH_WEST ||
            direction === CharacterDirection.SOUTH_WEST ? -2 :
            direction === CharacterDirection.EAST ||
            direction === CharacterDirection.NORTH_EAST ||
            direction === CharacterDirection.SOUTH_EAST ? 2 : 0;

        // Bong chan
        g.fillColor = new Color(25, 25, 25, 90);
        g.circle(0, -3, 11);
        g.fill();

        // Than ao
        g.fillColor = new Color(45, 90, 150, 255);
        g.moveTo(-8, -5 + bob);
        g.lineTo(8, -5 + bob);
        g.lineTo(11, 10 + bob);
        g.lineTo(0, 15 + bob);
        g.lineTo(-11, 10 + bob);
        g.close();
        g.fill();

        // Dai that lung
        g.fillColor = new Color(220, 175, 75, 255);
        g.fillRect(-8, 1 + bob, 16, 3);

        // Co va dau
        g.fillColor = new Color(235, 190, 150, 255);
        g.circle(headX, 17 + bob, 6);
        g.fill();

        // Toc
        g.fillColor = new Color(35, 28, 25, 255);
        g.circle(headX, 21 + bob, 5.5);
        g.fill();

        // Mat theo huong nhin
        g.fillColor = new Color(30, 25, 25, 255);
        if (
            direction === CharacterDirection.SOUTH ||
            direction === CharacterDirection.SOUTH_EAST ||
            direction === CharacterDirection.SOUTH_WEST
        ) {
            g.circle(headX + 2, 17 + bob, 0.9);
            g.fill();
        }

        // Tay ao
        g.fillColor = new Color(65, 115, 175, 255);
        g.circle(-10, 5 + bob, 3);
        g.fill();
        g.circle(10, 5 + bob, 3);
        g.fill();

        // Bao kiem
        g.strokeColor = new Color(220, 220, 225, 255);
        g.lineWidth = 2;
        g.moveTo(9, 0 + bob);
        g.lineTo(15, 13 + bob);
        g.stroke();
    }
}

import { useRef, type JSX } from "react";
import { getImageAsset } from "../assets/imageAssets";
import { coverRect } from "../model/crop";
import type { ImageCreatorProject } from "../model/types";
import { useElementSize } from "../hooks/useElementSize";
import { TextBox } from "./TextBox";
import styles from "./EditorCanvas.module.scss";

interface EditorCanvasProps {
  project: ImageCreatorProject;
  selectedElementId: string | null;
  onSelectElement(id: string | null): void;
  onMoveElement(id: string, x: number, y: number): void;
  onResizeElement(id: string, width: number): void;
  onChangeElementText(id: string, text: string): void;
}

export function EditorCanvas({
  project,
  selectedElementId,
  onSelectElement,
  onMoveElement,
  onResizeElement,
  onChangeElementText
}: EditorCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth, height: containerHeight } = useElementSize(containerRef);

  const asset = project.background ? getImageAsset(project.background.assetId) : undefined;
  const rect =
    project.background && asset && containerWidth > 0 && containerHeight > 0
      ? coverRect(asset.width, asset.height, containerWidth, containerHeight, project.background.crop)
      : null;

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.canvas}
        style={{ aspectRatio: `${project.canvas.width} / ${project.canvas.height}` }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelectElement(null);
        }}
      >
        {asset && rect && (
          // Decorative background, not user content — empty alt is correct here.
          // crossOrigin matches rendering/renderProject.ts's loader for the
          // same URL — requesting it once without and once with CORS mode
          // can make the browser reuse a cached "opaque" response either
          // way, which would taint the canvas at export time regardless of
          // what this preview element asks for.
          <img
            src={asset.objectUrl}
            alt=""
            crossOrigin="anonymous"
            className={styles.background}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            draggable={false}
          />
        )}

        {project.background?.overlay?.enabled && (
          <div
            className={styles.overlay}
            style={{ background: project.background.overlay.color, opacity: project.background.overlay.opacity }}
          />
        )}

        {project.elements.map((element) => (
          <TextBox
            key={element.id}
            element={element}
            selected={element.id === selectedElementId}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            onSelect={() => onSelectElement(element.id)}
            onMove={(x, y) => onMoveElement(element.id, x, y)}
            onResize={(width) => onResizeElement(element.id, width)}
            onChangeText={(text) => onChangeElementText(element.id, text)}
          />
        ))}
      </div>
    </div>
  );
}

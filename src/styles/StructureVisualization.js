import { Stage, Layer, Rect, Circle, Text } from "react-konva";

const StructureVisualization = ({
  config,
  layers,
  innerRadius,
  units,
  hInside,
  hOutside,
}) => {
  const canvasWidth = 600;
  const canvasHeight = 500;

  const safeNumber = (val, decimals = 2) =>
    !isFinite(val) || val == null
      ? (0).toFixed(decimals)
      : Number(val).toFixed(decimals);

  const drawStructure = () => {
    const shapeElements = [];
    const textElements = [];

    if (config === "Composite Wall") {
      let currentX = 50;
      const maxThickness =
        layers.reduce((sum, l) => sum + Number(l.thickness || 0), 0) || 1;
      const scale = (canvasWidth - 100) / maxThickness;

      layers.forEach((layer, i) => {
        const width = (Number(layer.thickness) || 0) * scale;
        shapeElements.push(
          <Rect
            key={`layer-${i}`}
            x={currentX}
            y={50}
            width={width}
            height={200}
            fill={["#ccccff", "#ccffcc", "#ffccff", "#ffffcc"][i % 4]}
            stroke="black"
            strokeWidth={1}
          />
        );
        textElements.push(
          <Text
            key={`layer-${i}-label`}
            x={currentX + width / 2}
            y={40}
            text={`Layer ${i + 1} (${safeNumber(layer.thickness)} ${
              units === "SI" ? "m" : "ft"
            })`}
            fontSize={14}
            fontStyle="bold"
            fill="#111"
            align="center"
          />
        );
        currentX += width;
      });
    } else {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      const maxOuterRadius =
        layers.length > 0
          ? Math.max(
              ...layers.map((l) => Number(l.outerRadius) || 0),
              innerRadius || 0
            )
          : innerRadius || 1;

      const scale = (canvasHeight / 2 - 40) / maxOuterRadius;

      let prevRadius =
        (innerRadius && !isNaN(innerRadius) ? innerRadius : 0) * scale;

      // Label for inner radius
      textElements.push(
        <Text
          key="inner-radius-label"
          x={centerX}
          y={centerY}
          text={`Inner R = ${safeNumber(innerRadius)} ${
            units === "SI" ? "m" : "ft"
          }`}
          fontSize={14}
          fontStyle="bold"
          fill="#111"
          align="center"
          padding={4}
          background="#ffffffcc"
        />
      );

      layers.forEach((layer, i) => {
        const outerRadius = Number(layer.outerRadius) || 0;
        const scaledOuter = outerRadius * scale;
        const thickness = Math.max(scaledOuter - prevRadius, 2);

        shapeElements.push(
          <Circle
            key={`layer-${i}`}
            x={centerX}
            y={centerY}
            radius={(scaledOuter + prevRadius) / 2}
            fill={null}
            stroke={["#4f46e5", "#10b981", "#f59e0b", "#ef4444"][i % 4]}
            strokeWidth={thickness || 2}
          />
        );
        textElements.push(
          <Text
            key={`layer-${i}-label`}
            x={centerX}
            y={centerY - scaledOuter - i}
            text={`Layer ${i + 1} (R = ${safeNumber(outerRadius)} ${
              units === "SI" ? "m" : "ft"
            })`}
            fontSize={14}
            fontStyle="bold"
            fill="#111"
            align="center"
            padding={4}
            background="#ffffffcc"
          />
        );

        prevRadius = scaledOuter;
      });
    }

    return { shapeElements, textElements };
  };

  const { shapeElements, textElements } = drawStructure();

  return (
    <Stage width={canvasWidth} height={canvasHeight}>
      <Layer>{shapeElements}</Layer>
      <Layer>{textElements}</Layer>
    </Stage>
  );
};

export default StructureVisualization;

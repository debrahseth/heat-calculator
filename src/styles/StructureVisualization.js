import { Stage, Layer, Rect, Circle, Text } from "react-konva";

const StructureVisualization = ({
  config,
  layers,
  innerRadius,
  units,
  siLengthUnit,
}) => {
  const canvasWidth = 600;
  const canvasHeight = 500;

  const safeNumber = (val, decimals = 2) =>
    !isFinite(val) || val == null
      ? (0).toFixed(decimals)
      : Number(val).toFixed(decimals);

  const unitLabel = units === "SI" ? siLengthUnit : "ft";

  const rectColors = ["#a3bffa", "#6ee7b7", "#fbbf24", "#fbcfe8"];
  const circleStrokes = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"];

  const drawStructure = () => {
    const shapeElements = [];
    const textElements = [];

    if (config === "Composite Wall") {
      let currentX = 50;
      const maxThickness =
        layers.reduce((sum, l) => sum + Number(l.thickness || 0), 0) || 1;
      const scale = (canvasWidth - 150) / maxThickness; // leave space for legend

      layers.forEach((layer, i) => {
        const width = (Number(layer.thickness) || 0) * scale;

        shapeElements.push(
          <Rect
            key={`layer-${i}`}
            x={currentX}
            y={50}
            width={width}
            height={200}
            fill={rectColors[i % rectColors.length]}
            stroke="#333"
            strokeWidth={2}
            cornerRadius={8}
            shadowColor="#000"
            shadowBlur={6}
            shadowOpacity={0.25}
            shadowOffset={{ x: 2, y: 2 }}
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

      textElements.push(
        <Text
          key="inner-radius-label"
          x={centerX}
          y={centerY}
          text={`Inner Pipe R = ${safeNumber(innerRadius)} ${unitLabel}`}
          fontSize={18}
          fontStyle="bold"
          fill="#000"
          align="center"
          verticalAlign="middle"
          padding={6}
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
            stroke={circleStrokes[i % circleStrokes.length]}
            strokeWidth={thickness || 2}
            shadowColor="#000"
            shadowBlur={5}
            shadowOpacity={0.2}
          />
        );

        prevRadius = scaledOuter;
      });
    }

    return { shapeElements, textElements };
  };

  const { shapeElements, textElements } = drawStructure();

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* Canvas */}
      <Stage
        width={canvasWidth}
        height={canvasHeight}
        style={{
          background: "#f0f4f8",
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        }}
      >
        <Layer>{shapeElements}</Layer>
        <Layer>{textElements}</Layer>
      </Stage>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Legend</h3>
        {layers.map((layer, i) => (
          <div
            key={`legend-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                backgroundColor:
                  config === "Composite Wall"
                    ? rectColors[i % rectColors.length]
                    : circleStrokes[i % circleStrokes.length],
                border: "1px solid #333",
                borderRadius: config === "Composite Wall" ? 4 : "50%",
              }}
            />
            <span>{layer.name || `Layer ${i + 1}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StructureVisualization;

import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Circle, Text } from "react-konva";

const StructureVisualization = ({
  config,
  layers,
  innerRadius,
  units,
  siLengthUnit,
}) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = Math.min(width * 0.8, 500);
        setDimensions({ width, height });
        setContainerWidth(width);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
    const { width: canvasWidth, height: canvasHeight } = dimensions;

    if (config === "Composite Wall") {
      const maxThickness =
        layers.reduce((sum, l) => sum + Number(l.thickness || 0), 0) || 1;
      const scale = (canvasWidth * 0.5) / maxThickness;

      let currentX = (canvasWidth - maxThickness * scale) / 3;
      const wallHeight = canvasHeight * 0.7;
      const wallY = (canvasHeight - wallHeight) / 2;

      layers.forEach((layer, i) => {
        const width = (Number(layer.thickness) || 0) * scale;

        shapeElements.push(
          <Rect
            key={`layer-${i}`}
            x={currentX}
            y={wallY}
            width={width}
            height={wallHeight}
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
          fontSize={Math.max(canvasWidth / 40, 14)}
          fontStyle="bold"
          fill="#000"
          align="center"
          verticalAlign="middle"
          padding={6}
          background="#ffffffcc"
          offsetX={100}
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
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: containerWidth > 400 ? "row" : "column",
        gap: 20,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stage
        width={containerWidth > 400 ? containerWidth - 120 : containerWidth}
        height={dimensions.height}
        style={{
          background: "#f0f4f8",
          borderRadius: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
        }}
      >
        <Layer>{shapeElements}</Layer>
        <Layer>{textElements}</Layer>
      </Stage>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: containerWidth > 400 ? "300px" : "100%",
          alignItems: containerWidth > 400 ? "flex-start" : "center",
        }}
      >
        <h3
          style={{
            margin: 0,
            textAlign: containerWidth > 400 ? "left" : "center",
            width: "100%",
            fontSize: "1.25rem",
            fontWeight: "bold",
          }}
        >
          Legend
        </h3>
        {layers.map((layer, i) => (
          <div
            key={`legend-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: Math.max(dimensions.width / 40, 14),
              fontWeight: "bold",
              justifyContent: containerWidth > 400 ? "flex-start" : "center",
              width: "100%",
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

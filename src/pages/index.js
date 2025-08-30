import { useState } from "react";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import dynamic from "next/dynamic";
const StructureVisualization = dynamic(
  () => import("../styles/StructureVisualization"),
  { ssr: false }
);

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center gap-2">
        <div
          {...listeners}
          className="cursor-grab text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white"
        >
          ☰
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const defaultState = {
    config: "Composite Wall",
    units: "SI",
    tempUnit: "C",
    area: 0,
    pipeLength: 0,
    innerRadius: 0.0,
    layers: [{ name: "Layer 1", thickness: 0, k: 0 }],
    hInside: 0,
    hOutside: 0,
    tHot: 0,
    tCold: 0,
  };

  const [config, setConfig] = useState(defaultState.config);
  const [units, setUnits] = useState(defaultState.units);
  const [tempUnit, setTempUnit] = useState(defaultState.tempUnit);
  const [area, setArea] = useState(defaultState.area);
  const [pipeLength, setPipeLength] = useState(defaultState.pipeLength);
  const [innerRadius, setInnerRadius] = useState(defaultState.innerRadius);
  const [layers, setLayers] = useState(defaultState.layers);
  const [hInside, setHInside] = useState(defaultState.hInside);
  const [hOutside, setHOutside] = useState(defaultState.hOutside);
  const [tHot, setTHot] = useState(defaultState.tHot);
  const [tCold, setTCold] = useState(defaultState.tCold);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [decimalPlaces, setDecimalPlaces] = useState(4);
  const [siLengthUnit, setSiLengthUnit] = useState("m");
  const [theme, setTheme] = useState("light");

  const convertUnits = (newUnits) => {
    if (newUnits === units) return;

    const lengthFactor = units === "SI" ? 1 : 0.3048;

    const newArea =
      config === "Composite Wall"
        ? units === "SI"
          ? area / 0.092903
          : area * 0.092903
        : area;

    const newPipeLength =
      units === "SI" ? pipeLength / 0.3048 : pipeLength * 0.3048;
    const newInnerRadius =
      units === "SI" ? innerRadius / 0.3048 : innerRadius * 0.3048;

    const newLayers = layers.map((layer) => {
      if (config === "Composite Wall") {
        const newThickness =
          units === "SI" ? layer.thickness / 0.3048 : layer.thickness * 0.3048;
        return { ...layer, thickness: newThickness };
      } else {
        const newOuterRadius =
          units === "SI"
            ? layer.outerRadius / 0.3048
            : layer.outerRadius * 0.3048;
        return { ...layer, outerRadius: newOuterRadius };
      }
    });

    const newHInside = units === "SI" ? hInside / 5.6783 : hInside * 5.6783;
    const newHOutside = units === "SI" ? hOutside / 5.6783 : hOutside * 5.6783;

    const newTHot =
      units === "SI" ? (tHot - 32) * (5 / 9) : tHot * (9 / 5) + 32;
    const newTCold =
      units === "SI" ? (tCold - 32) * (5 / 9) : tCold * (9 / 5) + 32;

    setUnits(newUnits);
    setArea(newArea);
    setPipeLength(newPipeLength);
    setInnerRadius(newInnerRadius);
    setLayers(newLayers);
    setHInside(newHInside);
    setHOutside(newHOutside);
    setTHot(newTHot);
    setTCold(newTCold);
  };

  const convertTemperatureUnit = (newTempUnit) => {
    if (newTempUnit === tempUnit) return;

    let newTHot = tHot;
    let newTCold = tCold;

    if (newTempUnit === "K") {
      newTHot = tHot + 273.15;
      newTCold = tCold + 273.15;
    } else {
      newTHot = tHot - 273.15;
      newTCold = tCold - 273.15;
    }

    setTempUnit(newTempUnit);
    setTHot(newTHot);
    setTCold(newTCold);
  };

  const addLayer = () => {
    const newLayerIndex = layers.length + 1;
    setLayers([
      ...layers,
      config === "Composite Wall"
        ? { name: `Layer ${newLayerIndex}`, thickness: 0.1, k: 1 }
        : {
            name: `Layer ${newLayerIndex}`,
            outerRadius:
              layers[layers.length - 1]?.outerRadius * 1.2 || innerRadius * 1.2,
            k: 1,
          },
    ]);
  };

  const updateLayer = (index, field, value) => {
    const newLayers = [...layers];
    newLayers[index][field] = field === "name" ? value : parseFloat(value) || 0;
    setLayers(newLayers);
  };

  const removeLayer = (index) => {
    const newLayers = [...layers];
    newLayers.splice(index, 1);
    setLayers(newLayers);
  };

  const resetAll = () => {
    setConfig(defaultState.config);
    setUnits(defaultState.units);
    setTempUnit(defaultState.tempUnit);
    setArea(defaultState.area);
    setPipeLength(defaultState.pipeLength);
    setInnerRadius(defaultState.innerRadius);
    setLayers(defaultState.layers);
    setHInside(defaultState.hInside);
    setHOutside(defaultState.hOutside);
    setTHot(defaultState.tHot);
    setTCold(defaultState.tCold);
  };

  const safeValue = (val, decimals = decimalPlaces) =>
    !isFinite(val) || isNaN(val)
      ? (0).toFixed(decimals)
      : val.toFixed(decimals);

  const calculate = () => {
    let totalR = 0;
    const layerResistances = [];
    const interfaceTemps = [];
    let criticalRadius = 0;
    let cumulativeR = 0;

    // Conversion factors
    let lengthFactor;
    if (siLengthUnit === "m") lengthFactor = 1;
    else if (siLengthUnit === "cm") lengthFactor = 0.01;
    else if (siLengthUnit === "mm") lengthFactor = 0.001;
    const areaCalc =
      config === "Composite Wall"
        ? units === "Imperial"
          ? area * 0.092903
          : area * (lengthFactor * lengthFactor)
        : 2 *
          Math.PI *
          innerRadius *
          lengthFactor *
          pipeLength *
          lengthFactor *
          (units === "Imperial" ? 0.3048 : 1);
    const tHotSI =
      units === "SI"
        ? tempUnit === "K"
          ? tHot - 273.15
          : tHot
        : (tHot - 32) * (5 / 9);
    const tColdSI =
      units === "SI"
        ? tempUnit === "K"
          ? tCold - 273.15
          : tCold
        : (tCold - 32) * (5 / 9);
    const tempDiff = tHotSI - tColdSI;
    const kFactor = units === "Imperial" ? 1.7307 : 1;
    const hFactor = units === "Imperial" ? 5.6783 : 1;
    const tempDisplayFactor = units === "Imperial" ? 9 / 5 : 1;

    if (config === "Pipe" && hOutside > 0 && layers.length > 0) {
      const k = layers[layers.length - 1].k * kFactor;
      const h = hOutside * hFactor;
      criticalRadius = k / h;
      if (units === "SI" && siLengthUnit === "mm") {
        criticalRadius *= 1000;
      }
    }

    // Inside convection
    if (hInside > 0) {
      const rIn = 1 / (hInside * hFactor * areaCalc);
      totalR += rIn;
      cumulativeR += rIn;
      layerResistances.push({ label: "Inside Convection", r: rIn });
      interfaceTemps.push({
        label: "After Inside Convection",
        temp: tHotSI - (tempDiff * cumulativeR) / totalR,
      });
    } else {
      interfaceTemps.push({ label: "Start", temp: tHotSI });
    }

    // Layers calculations
    layers.forEach((layer, i) => {
      let rLayer;
      if (config === "Composite Wall") {
        const thicknessSI = layer.thickness * lengthFactor;
        const kSI = layer.k * kFactor;
        rLayer = thicknessSI / (kSI * areaCalc);
      } else {
        const outerRadiusSI = layer.outerRadius * lengthFactor;
        const innerRadiusSI =
          i === 0
            ? innerRadius * lengthFactor
            : layers[i - 1].outerRadius * lengthFactor;
        const kSI = layer.k * kFactor;
        const pipeLengthSI = pipeLength * lengthFactor;
        rLayer =
          Math.log(outerRadiusSI / innerRadiusSI) /
          (2 * Math.PI * kSI * pipeLengthSI);
      }
      totalR += rLayer;
      layerResistances.push({ label: layer.name, r: rLayer });
    });

    layers.forEach((layer, i) => {
      cumulativeR += layerResistances[i + (hInside > 0 ? 1 : 0)].r;
      interfaceTemps.push({
        label: `After ${layer.name}`,
        temp: tHotSI - (tempDiff * cumulativeR) / totalR,
      });
    });

    // Outside convection
    if (hOutside > 0) {
      const outerArea =
        config === "Composite Wall"
          ? areaCalc
          : 2 *
            Math.PI *
            layers[layers.length - 1].outerRadius *
            lengthFactor *
            pipeLength *
            lengthFactor;
      const rOut = 1 / (hOutside * hFactor * outerArea);
      totalR += rOut;
      cumulativeR += rOut;
      layerResistances.push({ label: "Outside Convection", r: rOut });
      interfaceTemps.push({
        label: "After Outside Convection",
        temp: tHotSI - (tempDiff * cumulativeR) / totalR,
      });
    }

    const Q = tempDiff / totalR;
    const QDisplay = units === "Imperial" ? Q / 0.293 : Q;
    const totalRDisplay = units === "Imperial" ? totalR * 5.6783 : totalR;
    const U = 1 / (totalR * areaCalc);
    const UDisplay = units === "Imperial" ? U / 5.6783 : U;

    const interfaceTempsDisplay = interfaceTemps.map((item) => {
      let tempDisplay;
      if (units === "Imperial") {
        tempDisplay = item.temp * tempDisplayFactor + 32;
      } else {
        tempDisplay = tempUnit === "K" ? item.temp + 273.15 : item.temp;
      }
      return { ...item, temp: tempDisplay };
    });

    return {
      totalR: totalRDisplay,
      Q: QDisplay,
      U: UDisplay,
      layerResistances,
      interfaceTemps: interfaceTempsDisplay,
      criticalRadius,
    };
  };

  const { totalR, Q, U, layerResistances, interfaceTemps, criticalRadius } =
    calculate();

  const tempLabels = interfaceTemps.map((item) => item.label);
  const tempData = interfaceTemps.map((item) => item.temp);

  const tempChartData = {
    labels: tempLabels,
    datasets: [
      {
        label: "Temperature",
        data: tempData,
        fill: true,
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderColor: "rgba(99, 102, 241, 1)",
        tension: 0.4,
      },
    ],
  };

  const resistanceLabels = layerResistances.map((item) => item.label);
  const resistanceData = layerResistances.map((item) => item.r);

  const resistanceChartData = {
    labels: resistanceLabels,
    datasets: [
      {
        label: "Resistance",
        data: resistanceData,
        backgroundColor: "rgba(16, 185, 129, 0.6)",
        borderColor: "rgba(5, 150, 105, 1)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <div
      className={`min-h-screen p-8 ${
        theme === "dark"
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white"
          : "bg-gradient-to-br from-gray-100 via-white to-gray-200 text-gray-900"
      } transition-colors duration-500`}
    >
      <div className="container mx-auto max-w-8xl">
        <h1 className="text-7xl font-extrabold mb-10 text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text drop-shadow-lg">
          ⚡ Heat Transfer Calculator
        </h1>

        <div className="flex justify-center gap-4 mb-10 w-full">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex-1 px-5 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-700 text-white text-[30px] shadow-lg hover:scale-102 transition flex items-center justify-center gap-2"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setIsManualOpen(true)}
            className="flex-1 px-5 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[30px] shadow-lg hover:scale-102 transition flex items-center justify-center gap-2"
          >
            📖 Manual
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          {/* Configuration Card */}
          <div className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
              🔧 Configuration
            </h2>
            <div className="space-y-8">
              <div>
                <label className="block text-1xl font-bold mb-1">TYPE:</label>
                <select
                  value={config}
                  onChange={(e) => {
                    setConfig(e.target.value);
                    setLayers([{ thickness: 0.1, k: 1 }]);
                  }}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                >
                  <option>Composite Wall</option>
                  <option>Pipe</option>
                </select>
              </div>

              <div>
                <label className="block text-1xl font-bold mb-1">UNITS:</label>
                <select
                  value={units}
                  onChange={(e) => convertUnits(e.target.value)}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                >
                  <option value="SI">SI</option>
                  <option value="Imperial">Imperial</option>
                </select>
              </div>

              {units === "SI" && (
                <div>
                  <label className="block text-1xl font-bold mb-1">
                    TEMPERATURE UNIT:
                  </label>
                  <select
                    value={tempUnit}
                    onChange={(e) => convertTemperatureUnit(e.target.value)}
                    className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
        ${
          theme === "light"
            ? "bg-white text-black border-gray-300"
            : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        }`}
                  >
                    <option value="C">°C</option>
                    <option value="K">K</option>
                  </select>
                </div>
              )}
              {config === "Composite Wall" ? (
                <div>
                  <label className="block text-1xl font-bold mb-1">
                    SURFACE AREA ({units === "SI" ? `${siLengthUnit}²` : "ft²"}
                    ):
                  </label>
                  <input
                    type="number"
                    value={area}
                    onChange={(e) => setArea(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                    min="0"
                  />
                </div>
              ) : (
                <div className="grid gap-4">
                  <div>
                    <label className="block text-1xl font-bold mb-1">
                      PIPE LENGTH ({units === "SI" ? siLengthUnit : "ft"}):
                    </label>
                    <input
                      type="number"
                      value={pipeLength}
                      onChange={(e) =>
                        setPipeLength(parseFloat(e.target.value) || 0)
                      }
                      className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-1xl font-bold mb-1">
                      Inner Radius ({units === "SI" ? siLengthUnit : "ft"}):
                    </label>
                    <input
                      type="number"
                      value={innerRadius}
                      onChange={(e) =>
                        setInnerRadius(parseFloat(e.target.value) || 0)
                      }
                      className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Convection & Temps */}
          <div className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
              🌡️ Convective Heat Coefficient & Temperatures
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-1xl font-bold mb-1">
                  INTERNAL CONVECTIVE HEAT COEFFICIENT - hi (
                  {units === "SI" ? `W/m²·K` : "Btu/hr·ft²·°F"}):
                </label>
                <input
                  type="number"
                  value={hInside}
                  onChange={(e) => setHInside(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                />
              </div>
              <div>
                <label className="block text-1xl font-bold mb-1">
                  EXTERNAL CONVECTIVE HEAT COEFFICIENT - ho (
                  {units === "SI" ? `W/m²·K` : "Btu/hr·ft²·°F"}):
                </label>
                <input
                  type="number"
                  value={hOutside}
                  onChange={(e) => setHOutside(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                />
              </div>
              <div>
                <label className="block text-1xl font-bold mb-1">
                  HOT TEMPERATURE - Ti (
                  {units === "SI" ? (tempUnit === "C" ? "°C" : "K") : "°F"}):
                </label>
                <input
                  type="number"
                  value={tHot}
                  onChange={(e) => setTHot(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                />
              </div>
              <div>
                <label className="block text-1xl font-bold mb-1">
                  COLD TEMPERATURE - To (
                  {units === "SI" ? (tempUnit === "C" ? "°C" : "K") : "°F"}):
                </label>
                <input
                  type="number"
                  value={tCold}
                  onChange={(e) => setTCold(parseFloat(e.target.value) || 0)}
                  className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
  ${
    theme === "light"
      ? "bg-white text-black border-gray-300"
      : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Layers */}
        <div className="flex gap-6 w-full">
          {/* Left side: Layers (50%) */}
          <div className="w-1/2 h-[600px] overflow-y-auto backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
              🧱 Layers
            </h2>

            {/* Map Layers */}
            <DndContext
              sensors={useSensors(useSensor(PointerSensor))}
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (active.id !== over.id) {
                  const oldIndex = layers.findIndex(
                    (layer, i) => `layer-${i}` === active.id
                  );
                  const newIndex = layers.findIndex(
                    (layer, i) => `layer-${i}` === over.id
                  );
                  setLayers(arrayMove(layers, oldIndex, newIndex));
                }
              }}
            >
              <SortableContext
                items={layers.map((_, i) => `layer-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                {layers.map((layer, i) => (
                  <SortableItem key={i} id={`layer-${i}`}>
                    <div className="mb-5 p-5 rounded-xl border dark:border-gray-600 bg-gray-50/70 dark:bg-gray-700/70 shadow-md">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-medium">Layer {i + 1}</h3>
                        {layers.length > 1 && (
                          <button
                            onClick={() => removeLayer(i)}
                            className="px-3 py-1 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg shadow hover:scale-102 transition"
                          >
                            REMOVE
                          </button>
                        )}
                      </div>

                      {/* Inputs per layer */}
                      <div>
                        <label className="block text-1xl font-bold mb-1">
                          Layer Name:
                        </label>
                        <input
                          type="text"
                          value={layer.name}
                          onChange={(e) =>
                            updateLayer(i, "name", e.target.value)
                          }
                          className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
${
  theme === "light"
    ? "bg-white text-black border-gray-300"
    : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
}`}
                        />
                      </div>

                      <div>
                        <div>
                          <label className="block text-1xl font-bold mb-1">
                            {config === "Composite Wall"
                              ? "THICKNESS"
                              : "OUTER RADIUS"}{" "}
                            ({units === "SI" ? siLengthUnit : "ft"}):
                          </label>
                          <input
                            type="number"
                            value={
                              config === "Composite Wall"
                                ? layer.thickness
                                : layer.outerRadius
                            }
                            onChange={(e) =>
                              updateLayer(
                                i,
                                config === "Composite Wall"
                                  ? "thickness"
                                  : "outerRadius",
                                e.target.value
                              )
                            }
                            className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
${
  theme === "light"
    ? "bg-white text-black border-gray-300"
    : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
}`}
                          />
                        </div>

                        <div>
                          <label className="block text-1xl font-bold mb-1">
                            THERMAL CONDUCTIVITY - k (
                            {units === "SI" ? `W/m·K` : "Btu/hr·ft·°F"}):
                          </label>
                          <input
                            type="number"
                            value={layer.k}
                            onChange={(e) =>
                              updateLayer(i, "k", e.target.value)
                            }
                            className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 
${
  theme === "light"
    ? "bg-white text-black border-gray-300"
    : "dark:bg-gray-700 dark:border-gray-600 dark:text-white"
}`}
                          />
                        </div>
                      </div>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>

            {/* Add / Reset buttons */}
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={addLayer}
                className="flex-1 text-lg px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg shadow-lg hover:scale-102 transition"
              >
                ➕ Add Layer
              </button>
              <button
                onClick={resetAll}
                className="flex-1 text-lg px-5 py-3 bg-gradient-to-r from-gray-500 to-gray-700 text-white rounded-lg shadow-lg hover:scale-102 transition"
              >
                🔄 Reset All
              </button>
            </div>
          </div>

          {/* Right side: Visualization (50%) */}
          <div className="w-1/2 h-[600px] flex flex-col items-center justify-center backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            {/* Title */}
            <h2 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400 mb-4 text-center">
              🔍 Configuration Preview
            </h2>

            <div className="flex-1 flex items-center justify-center w-full">
              <StructureVisualization
                config={config}
                layers={layers}
                innerRadius={innerRadius}
                units={units}
                siLengthUnit={siLengthUnit}
              />
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="mt-10">
          <div className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-semibold mb-6 text-indigo-600 dark:text-indigo-400">
              📊 Results
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  label: "Total R",
                  value: totalR,
                  unit: units === "SI" ? "m²·K/W" : "hr·ft²·°F/Btu",
                },
                {
                  label: "Overall U",
                  value: U,
                  unit: units === "SI" ? "W/m²·K" : "Btu/hr·ft²·°F",
                },
                {
                  label: "Heat Rate Q",
                  value: Q,
                  unit: units === "SI" ? "W" : "Btu/hr",
                },
                ...(config === "Pipe"
                  ? [
                      {
                        label: "Critical Radius (Rcr)",
                        value: criticalRadius,
                        unit: units === "SI" ? siLengthUnit : "ft",
                      },
                    ]
                  : []),
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-xl bg-indigo-100 dark:bg-gray-700 text-center shadow-lg hover:scale-[1.02] transition"
                >
                  <p className="font-semibold mb-2">{item.label}</p>
                  <p className="text-2xl font-bold">
                    {item.value !== null ? safeValue(item.value) : "N/A"}{" "}
                    <span className="text-lg font-normal">{item.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Individual Resistances */}
            {layerResistances.length > 0 && (
              <div className="mt-10">
                <h3 className="text-xl font-bold mb-6 text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text">
                  ⚡ Individual Resistances
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {" "}
                  {/* Added lg breakpoint */}
                  {layerResistances.map((item, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl bg-white/70 dark:bg-gray-800/70 shadow-md border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm hover:shadow-lg hover:scale-[1.02] transition"
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {item.label}
                      </p>
                      <p className="text-[20px] font-semibold text-gray-900 dark:text-white">
                        {safeValue(item.r)}{" "}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400">
                          {units === "SI" ? `m²·K/W` : "hr·ft²·°F/Btu"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interface Temperatures */}
            {interfaceTemps.length > 0 && (
              <div className="mt-10">
                <h3 className="text-xl font-bold mb-6 text-center bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-transparent bg-clip-text">
                  🌡️ Interface Temperatures
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {" "}
                  {/* Added lg breakpoint */}
                  {interfaceTemps.map((item, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl bg-white/70 dark:bg-gray-800/70 shadow-md border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm hover:shadow-lg hover:scale-[1.02] transition"
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {item.label}
                      </p>
                      <p className="text-[20px] font-semibold text-gray-900 dark:text-white">
                        {safeValue(item.temp)}{" "}
                        <span className="text-lg font-normal text-gray-500 dark:text-gray-400">
                          {units === "SI"
                            ? tempUnit === "C"
                              ? "°C"
                              : "K"
                            : "°F"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Temperature Profile */}
          <div className="p-6 rounded-xl bg-white/70 dark:bg-gray-800/80 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400 text-center">
              🌡️ Temperature Profile
            </h3>
            <Line
              data={tempChartData}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" } },
                scales: {
                  y: {
                    title: {
                      display: true,
                      text: `Temperature (${
                        units === "SI" ? (tempUnit === "C" ? "°C" : "K") : "°F"
                      })`,
                    },
                  },
                },
              }}
            />
          </div>

          {/* Layer Resistances */}
          <div className="p-6 rounded-xl bg-white/70 dark:bg-gray-800/80 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-indigo-600 dark:text-indigo-400 text-center">
              🧱 Layer Resistances
            </h3>
            <Bar
              data={resistanceChartData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    title: {
                      display: true,
                      text: `Resistance (${
                        units === "SI" ? "m²·K/W" : "hr·ft²·°F/Btu"
                      })`,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Step-by-Step Solution */}
        <div className="mt-10">
          <div className="backdrop-blur-sm bg-white/70 dark:bg-gray-800/80 p-6 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-semibold mb-6 text-indigo-600 dark:text-indigo-400 text-center">
              📝 Step-by-Step Solution
            </h2>

            <div className="space-y-6 max-h-[1000px] overflow-y-auto">
              {/* 1️⃣ Total Thermal Resistance */}
              <div className="p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg border-l-4 border-indigo-500">
                <p className="font-semibold mb-2">
                  1️⃣ Total Thermal Resistance:
                </p>

                {config === "Composite Wall" ? (
                  <>
                    <BlockMath math={`R_{inside} = \\frac{1}{h_{i} A}`} />
                    <BlockMath math={`R_{outside} = \\frac{1}{h_{o} A}`} />
                    {layers.map((layer, i) => (
                      <BlockMath
                        key={i}
                        math={`R_{${layer.name}} = \\frac{${safeValue(
                          layer.thickness
                        )}}{${safeValue(layer.k)} \\cdot A}`}
                      />
                    ))}
                    <BlockMath
                      math={`R_{total} = R_{inside} + \\sum_{i=1}^{n} R_{layer_i} + R_{outside}`}
                    />
                  </>
                ) : (
                  <>
                    <BlockMath
                      math={`R_{inside} = \\frac{1}{h_i 2 \\pi r_i L}`}
                    />
                    <BlockMath
                      math={`R_{outside} = \\frac{1}{h_o 2 \\pi r_o L}`}
                    />
                    {layers.map((layer, i) => (
                      <BlockMath
                        key={i}
                        math={`R_{${layer.name}} = \\frac{\\ln(${safeValue(
                          layer.outerRadius
                        )}/${safeValue(
                          i === 0 ? innerRadius : layers[i - 1].outerRadius
                        )})}{2 \\pi ${safeValue(layer.k)} L}`}
                      />
                    ))}
                    <BlockMath
                      math={`R_{total} = R_{inside} + \\sum_{i=1}^{n} R_{layer_i} + R_{outside}`}
                    />
                  </>
                )}

                <p className="mt-2 font-medium">
                  Calculated:{" "}
                  <span className="text-indigo-700 dark:text-indigo-300">
                    {safeValue(totalR)}{" "}
                    {config === "Composite Wall"
                      ? units === "SI"
                        ? "m²·K/W"
                        : "hr·ft²·°F/Btu"
                      : units === "SI"
                      ? "K/W"
                      : "°F·hr/Btu"}
                  </span>
                </p>

                {/* Layer breakdown table */}
                {layers.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-indigo-100 dark:bg-gray-600">
                          <th className="px-2 py-1 border">Layer</th>
                          <th className="px-2 py-1 border">R (Calculated)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {layers.map((layer, i) => (
                          <tr
                            key={i}
                            className={`border ${
                              i % 2 === 0
                                ? "bg-indigo-50 dark:bg-gray-700/70"
                                : ""
                            }`}
                          >
                            <td className="px-2 py-1 border">{layer.name}</td>
                            <td className="px-2 py-1 border">
                              {config === "Composite Wall"
                                ? safeValue(layer.thickness / (layer.k * area))
                                : safeValue(
                                    Math.log(
                                      layer.outerRadius /
                                        (i === 0
                                          ? innerRadius
                                          : layers[i - 1].outerRadius)
                                    ) /
                                      (2 * Math.PI * layer.k * pipeLength)
                                  )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2️⃣ Heat Transfer Rate */}
              <div className="p-4 bg-green-50 dark:bg-gray-700 rounded-lg border-l-4 border-green-500">
                <p className="font-semibold mb-2">2️⃣ Heat Transfer Rate:</p>
                <BlockMath
                  math={
                    config === "Composite Wall"
                      ? `Q = \\frac{T_{hot} - T_{cold}}{R_{total}} = \\frac{${safeValue(
                          tHot - tCold
                        )}}{${safeValue(totalR)}}`
                      : `Q = \\frac{T_{inside} - T_{outside}}{R_{total}} = \\frac{${safeValue(
                          tHot - tCold
                        )}}{${safeValue(totalR)}}`
                  }
                />
                <p className="mt-2 font-medium">
                  Calculated:{" "}
                  <span className="text-green-700 dark:text-green-300">
                    {safeValue(Q)} {units === "SI" ? "W" : "Btu/hr"}
                  </span>
                </p>
              </div>

              {/* 3️⃣ Critical Radius (Pipe only) */}
              {config === "Pipe" && (
                <div className="p-4 bg-yellow-50 dark:bg-gray-700 rounded-lg border-l-4 border-yellow-500">
                  <p className="font-semibold mb-2">
                    3️⃣ Critical Radius of Insulation:
                  </p>
                  <BlockMath
                    math={`R_{cr} = \\frac{k}{h_o} = \\frac{${safeValue(
                      layers[layers.length - 1]?.k
                    )}}{${safeValue(hOutside)}}`}
                  />
                  <p className="mt-2 font-medium">
                    Calculated:{" "}
                    <span className="text-yellow-700 dark:text-yellow-300">
                      {safeValue(criticalRadius)}{" "}
                      {units === "SI" ? siLengthUnit : "ft"}
                    </span>
                  </p>
                </div>
              )}

              {/* 4️⃣ Overall Heat Transfer Coefficient */}
              <div className="p-4 bg-yellow-50 dark:bg-gray-700 rounded-lg border-l-4 border-yellow-500">
                <p className="font-semibold mb-2">
                  4️⃣ Overall Heat Transfer Coefficient:
                </p>
                <BlockMath math={`U = \\frac{1}{R_{total} \\cdot A}`} />
                <p className="mt-2 font-medium">
                  Calculated:{" "}
                  <span className="text-yellow-700 dark:text-yellow-300">
                    {safeValue(U)} {units === "SI" ? "W/m²·K" : "Btu/hr·ft²·°F"}
                  </span>
                </p>
              </div>

              {/* 5️⃣ Interface Temperatures */}
              <div className="p-4 bg-pink-50 dark:bg-gray-700 rounded-lg border-l-4 border-pink-500">
                <p className="font-semibold mb-4">5️⃣ Interface Temperatures:</p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-pink-100 dark:bg-gray-600">
                        <th className="px-2 py-1 border">Interface</th>
                        <th className="px-2 py-1 border">Temperature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interfaceTemps.map((item, i) => {
                        const unit =
                          units === "SI"
                            ? tempUnit === "C"
                              ? "°C"
                              : "K"
                            : "°F";
                        return (
                          <tr
                            key={i}
                            className={`${
                              i % 2 === 0
                                ? "bg-pink-50 dark:bg-gray-700/70"
                                : ""
                            }`}
                          >
                            <td className="px-2 py-1 border">{item.label}</td>
                            <td className="px-2 py-1 border">
                              {safeValue(item.temp)} {unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Modal */}
        {isManualOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="relative bg-white/80 dark:bg-gray-900/80 p-8 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[85vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
              {/* Gradient Header */}
              <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text">
                📖 User Manual
              </h2>

              {/* Scrollable Content */}
              <div className="space-y-8 text-gray-800 dark:text-gray-300 leading-relaxed">
                <section>
                  <h3 className="text-xl font-semibold text-indigo-500 dark:text-indigo-400 mb-3">
                    🔣 Abbreviations
                  </h3>
                  <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
                    <li>
                      k - Thermal Conductivity (
                      {units === "SI" ? `W/m·K` : "Btu/hr·ft·°F"})
                    </li>
                    <li>
                      h - Convection Coefficient (
                      {units === "SI"
                        ? `W/${siLengthUnit}²·K`
                        : "Btu/hr·ft²·°F"}
                      )
                    </li>
                    <li>
                      R - Thermal Resistance (
                      {units === "SI" ? `m²·K/W` : "hr·ft²·°F/Btu"})
                    </li>
                    <li>
                      Q - Heat Transfer Rate ({units === "SI" ? "W" : "Btu/hr"})
                    </li>
                    <li>ΔT - Temperature Difference</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-semibold text-indigo-500 dark:text-indigo-400 mb-3">
                    🔧 How to Use
                  </h3>
                  <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
                    <li>Select configuration (Composite Wall / Pipe).</li>
                    <li>Enter dimensions, units, and materials.</li>
                    <li>Add or remove layers as needed.</li>
                    <li>Set convection coefficients and temperatures.</li>
                    <li>View results instantly below.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-xl font-semibold text-indigo-500 dark:text-indigo-400 mb-3">
                    📊 Results Explained
                  </h3>
                  <ul className="list-disc pl-6 space-y-2 text-sm md:text-base">
                    <li>
                      <strong>Total R:</strong> Sum of all resistances
                    </li>
                    <li>
                      <strong>Overall U:</strong> Heat transfer coefficient
                      (1/Total R)
                    </li>
                    <li>
                      <strong>Heat Rate Q:</strong> Q = ΔT / Total R
                    </li>
                    <li>
                      <strong>Interface Temps:</strong> Temperatures at each
                      boundary
                    </li>
                  </ul>
                </section>
              </div>

              {/* Footer */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setIsManualOpen(false)}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg shadow-lg hover:scale-102 hover:shadow-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="relative bg-white/90 dark:bg-gray-900/90 p-8 rounded-2xl shadow-2xl max-w-7xl w-full border border-gray-200/50 dark:border-gray-700/50">
              {/* Gradient Header */}
              <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text">
                ⚙️ Settings
              </h2>

              <div className="space-y-6 text-gray-800 dark:text-gray-100">
                {/* Decimal Places */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Decimal Places (0-100):
                  </label>
                  <input
                    type="number"
                    value={decimalPlaces}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (isNaN(val) || val < 0) val = 0;
                      else if (val > 100) val = 100;
                      setDecimalPlaces(val);
                    }}
                    min="0"
                    max="100"
                    className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Length Unit */}
                {units === "SI" && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Length Unit:
                    </label>
                    <select
                      value={siLengthUnit}
                      onChange={(e) => setSiLengthUnit(e.target.value)}
                      className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    >
                      <option value="m">Meters (m)</option>
                      <option value="mm">Millimeters (mm)</option>
                      <option value="cm">Centimeters (cm)</option>
                    </select>
                  </div>
                )}

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Theme:
                  </label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    <option value="light">🌞 Light</option>
                    <option value="dark">🌙 Dark</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg hover:scale-102 hover:shadow-xl transition text-[20px] flex-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

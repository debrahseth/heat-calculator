import { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import Link from "next/link";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale
);

export default function HeatExchanger() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState("counter");
  const [shellConfig, setShellConfig] = useState("1-2");
  const [theme, setTheme] = useState("light");
  const [selectedUnknowns, setSelectedUnknowns] = useState(new Set());
  const [requiredKnowns, setRequiredKnowns] = useState(new Set());
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  const parameters = useMemo(
    () => [
      { id: "Th_in", label: "Hot Inlet Temperature", siUnit: "°C" },
      { id: "Tc_in", label: "Cold Inlet Temperature", siUnit: "°C" },
      { id: "Th_out", label: "Hot Outlet Temperature", siUnit: "°C" },
      { id: "Tc_out", label: "Cold Outlet Temperature", siUnit: "°C" },
      { id: "m_h", label: "Hot Mass Flow Rate", siUnit: "kg/s" },
      { id: "m_c", label: "Cold Mass Flow Rate", siUnit: "kg/s" },
      { id: "cp_h", label: "Hot Specific Heat", siUnit: "J/kg·K" },
      { id: "cp_c", label: "Cold Specific Heat", siUnit: "J/kg·K" },
      { id: "A", label: "Heat Transfer Area", siUnit: "m²" },
      { id: "U", label: "Overall Heat Transfer Coefficient", siUnit: "W/m²·K" },
      { id: "Q", label: "Heat Transfer Rate", siUnit: "W" },
    ],
    []
  );

  const performanceParameters = useMemo(
    () => [
      { id: "epsilon", label: "Effectiveness (ε)", unit: "dimensionless" },
      {
        id: "NTU",
        label: "Number of Transfer Units (NTU)",
        unit: "dimensionless",
      },
      { id: "Cr", label: "Capacity Ratio (Cr)", unit: "dimensionless" },
      { id: "Qmax", label: "Maximum Heat Transfer Rate (Qmax)", unit: "W" },
      { id: "thermalEfficiency", label: "Thermal Efficiency", unit: "%" },
      { id: "LMTD", label: "LMTD (corrected)", unit: "°C" },
      {
        id: "LMTD_uncorrected",
        label: "LMTD (uncorrected)",
        unit: "°C",
      },
      {
        id: "correctionFactor",
        label: "LMTD Correction Factor (F)",
        unit: "dimensionless",
      },
    ],
    []
  );

  const performanceDependencies = {
    epsilon: ["Th_in", "Tc_in", "Q", "m_h", "m_c", "cp_h", "cp_c"],
    NTU: ["U", "A", "m_h", "m_c", "cp_h", "cp_c"],
    Cr: ["m_h", "m_c", "cp_h", "cp_c"],
    Qmax: ["Th_in", "Tc_in", "m_h", "m_c", "cp_h", "cp_c"],
    thermalEfficiency: ["Th_in", "Tc_in", "Q", "m_h", "m_c", "cp_h", "cp_c"],
    LMTD: ["Th_in", "Tc_in", "Th_out", "Tc_out"],
    correctionFactor: ["Th_in", "Tc_in", "Th_out", "Tc_out"],
  };

  const exchangerTypes = [
    { id: "counter", label: "Counter Flow" },
    { id: "parallel", label: "Parallel Flow" },
    { id: "shell-tube", label: "Shell-and-Tube" },
    { id: "performance", label: "Performance Parameters Only" },
  ];

  const getParameterLabel = (param) => `${param.label} (${param.siUnit})`;

  const calculateCorrectionFactor = (P, R, config) => {
    if (P <= 0 || P >= 1 || R <= 0) return 1;
    try {
      switch (config) {
        case "1-2":
          if (Math.abs(R - 1) < 1e-6) {
            const F =
              (Math.sqrt(2) * (1 - P)) /
              (P *
                Math.log(
                  (2 - P * (1 + 1 / Math.sqrt(2))) /
                    (2 - P * (1 - 1 / Math.sqrt(2)))
                ));
            return isFinite(F) ? F : 1;
          }
          const S = Math.sqrt(R * R + 1) / (R - 1);
          const W = Math.pow((1 - P) / (1 - P * R), 1 / 2);
          if (Math.abs(W - 1) < 1e-6) return 1;
          const arg1 = (1 + W - S + S * W) / (1 + W + S - S * W);
          if (arg1 <= 0) return 1;
          const F = (S * Math.log(W)) / Math.log(arg1);
          return isFinite(F) && F > 0 ? F : 1;
        case "2-4":
        case "1-4":
        case "1-6":
          return 1;
        case "counter":
        case "parallel":
        default:
          return 1;
      }
    } catch {
      return 1;
    }
  };

  const calculateHeatExchanger = () => {
    setError(null);
    try {
      const calculated = solveHeatExchanger(
        inputs,
        requiredKnowns,
        selectedUnknowns,
        type,
        shellConfig
      );
      setResults(calculated);
    } catch (err) {
      setError(
        `Calculation failed: ${err.message}. Received inputs: ${JSON.stringify(
          inputs
        )}`
      );
    }
  };

  // ---- Solver ----
  const solveHeatExchanger = (
    inputs,
    knownsSet,
    unknownsSet,
    flowType,
    shellCfg
  ) => {
    const isNumber = (v) => typeof v === "number" && isFinite(v);

    const knownArray = Array.from(knownsSet);
    const unknownArray = Array.from(unknownsSet);

    if (knownArray.length === 0)
      throw new Error("No valid known parameters provided.");
    if (unknownArray.length === 0)
      throw new Error("Select at least one unknown parameter.");

    const known = {};
    for (const id of knownArray) {
      const val = inputs[id];
      if (!isNumber(val)) {
        throw new Error(`Missing or invalid value for ${id}`);
      }
      known[id] = val;
    }

    const results = { ...known };

    // Heat capacity rates
    const C_h =
      isNumber(known.m_h) && isNumber(known.cp_h)
        ? known.m_h * known.cp_h
        : null;
    const C_c =
      isNumber(known.m_c) && isNumber(known.cp_c)
        ? known.m_c * known.cp_c
        : null;
    const C_min = C_h !== null && C_c !== null ? Math.min(C_h, C_c) : null;
    const C_max = C_h !== null && C_c !== null ? Math.max(C_h, C_c) : null;
    const Cr = C_min && C_max ? C_min / C_max : null;

    // LMTD helper
    const computeLMTD = (Th_in, Tc_in, Th_out, Tc_out, flowType) => {
      if (![Th_in, Tc_in, Th_out, Tc_out].every(isNumber)) return null;
      const dt1 = flowType === "parallel" ? Th_in - Tc_in : Th_in - Tc_out;
      const dt2 = flowType === "parallel" ? Th_out - Tc_out : Th_out - Tc_in;
      if (dt1 <= 0 || dt2 <= 0) return null;
      if (Math.abs(dt1 - dt2) < 1e-6) return dt1;
      return (dt1 - dt2) / Math.log(dt1 / dt2);
    };

    const computeEffectiveLMTD = (
      Th_in,
      Tc_in,
      Th_out,
      Tc_out,
      type,
      shellConfig
    ) => {
      const LMTD_uncorrected = computeLMTD(Th_in, Tc_in, Th_out, Tc_out, type);
      if (type === "shell-tube" && shellConfig) {
        const P = (Tc_out - Tc_in) / (Th_in - Tc_in);
        const R = (Th_in - Th_out) / (Tc_out - Tc_in);
        const F = calculateCorrectionFactor(P, R, shellConfig);
        return F * LMTD_uncorrected;
      }
      return LMTD_uncorrected;
    };

    // --- Interdependent Calculations ---
    const calculateInterdependentUnknowns = () => {
      if (unknownArray.includes("Q") && known.Th_in && known.Th_out && C_h) {
        results.Q = C_h * (known.Th_in - known.Th_out);
      } else if (
        unknownArray.includes("Q") &&
        known.Tc_in &&
        known.Tc_out &&
        C_c
      ) {
        results.Q = C_c * (known.Tc_out - known.Tc_in);
      }

      if (unknownArray.includes("Th_out") && results.Q && known.Th_in && C_h) {
        results.Th_out = known.Th_in - results.Q / C_h;
      }
      if (unknownArray.includes("Tc_out") && results.Q && known.Tc_in && C_c) {
        results.Tc_out = known.Tc_in + results.Q / C_c;
      }

      if (
        unknownArray.includes("m_h") &&
        results.Q &&
        known.Th_in &&
        known.Th_out &&
        known.cp_h
      ) {
        results.m_h = results.Q / (known.cp_h * (known.Th_in - known.Th_out));
      }
      if (
        unknownArray.includes("m_c") &&
        results.Q &&
        known.Tc_in &&
        known.Tc_out &&
        known.cp_c
      ) {
        results.m_c = results.Q / (known.cp_c * (known.Tc_out - known.Tc_in));
      }

      if (
        unknownArray.includes("cp_h") &&
        results.Q &&
        known.m_h &&
        known.Th_in &&
        known.Th_out
      ) {
        results.cp_h = results.Q / (known.m_h * (known.Th_in - known.Th_out));
      }
      if (
        unknownArray.includes("cp_c") &&
        results.Q &&
        known.m_c &&
        known.Tc_in &&
        known.Tc_out
      ) {
        results.cp_c = results.Q / (known.m_c * (known.Tc_out - known.Tc_in));
      }

      if (
        unknownArray.includes("Th_in") &&
        results.Q &&
        known.Th_out &&
        known.m_h &&
        known.cp_h
      ) {
        results.Th_in = known.Th_out + results.Q / (known.m_h * known.cp_h);
      }
      if (
        unknownArray.includes("Tc_in") &&
        results.Q &&
        known.Tc_out &&
        known.m_c &&
        known.cp_c
      ) {
        results.Tc_in = known.Tc_out - results.Q / (known.m_c * known.cp_c);
      }

      if (
        unknownArray.includes("A") &&
        results.Q &&
        known.U &&
        (results.Th_in || known.Th_in) &&
        (results.Tc_in || known.Tc_in) &&
        (results.Th_out || known.Th_out) &&
        (results.Tc_out || known.Tc_out)
      ) {
        const lmtd = computeEffectiveLMTD(
          results.Th_in || known.Th_in,
          results.Tc_in || known.Tc_in,
          results.Th_out || known.Th_out,
          results.Tc_out || known.Tc_out,
          type,
          shellConfig
        );
        if (lmtd > 0) results.A = results.Q / (known.U * lmtd);
      }

      if (
        unknownArray.includes("U") &&
        results.Q &&
        known.A &&
        (results.Th_in || known.Th_in) &&
        (results.Tc_in || known.Tc_in) &&
        (results.Th_out || known.Th_out) &&
        (results.Tc_out || known.Tc_out)
      ) {
        const lmtd = computeEffectiveLMTD(
          results.Th_in || known.Th_in,
          results.Tc_in || known.Tc_in,
          results.Th_out || known.Th_out,
          results.Tc_out || known.Tc_out,
          type,
          shellConfig
        );
        if (lmtd > 0) results.U = results.Q / (known.A * lmtd);
      }
    };

    calculateInterdependentUnknowns();

    const finalQ =
      results.Q ||
      known.Q ||
      (known.Th_in && results.Th_out && C_h
        ? C_h * (known.Th_in - results.Th_out)
        : known.Tc_in && results.Tc_out && C_c
        ? C_c * (results.Tc_out - known.Tc_in)
        : null);

    const finalTh_in = results.Th_in || known.Th_in;
    const finalTc_in = results.Tc_in || known.Tc_in;
    const finalTh_out = results.Th_out || known.Th_out;
    const finalTc_out = results.Tc_out || known.Tc_out;
    const finalA = results.A || known.A;
    const finalU = results.U || known.U;

    // 🔥 Maximum Heat Transfer Rate
    if (C_min && finalTh_in && finalTc_in) {
      results.Qmax = C_min * (finalTh_in - finalTc_in);
    }

    // 🔥 Effectiveness (ε) and Thermal Efficiency
    if (finalQ && C_min && finalTh_in && finalTc_in) {
      results.epsilon = finalQ / (C_min * (finalTh_in - finalTc_in));
      results.thermalEfficiency = results.epsilon * 100; // in %
    }

    // 🔥 NTU
    if (finalU && finalA && C_min) {
      results.NTU = (finalU * finalA) / C_min;
    }

    // 🔥 Capacity Ratio
    if (C_min && C_max) {
      results.Cr = C_min / C_max;
    }

    // 🔥 LMTD and Correction Factor
    if (finalTh_in && finalTc_in && finalTh_out && finalTc_out) {
      const LMTD_uncorrected = computeLMTD(
        finalTh_in,
        finalTc_in,
        finalTh_out,
        finalTc_out
      );
      results.LMTD_uncorrected = LMTD_uncorrected;

      if (shellCfg !== "counter" && shellCfg !== "parallel") {
        const P = (finalTc_out - finalTc_in) / (finalTh_in - finalTc_in);
        const R = (finalTh_in - finalTh_out) / (finalTc_out - finalTc_in);
        results.correctionFactor = calculateCorrectionFactor(P, R, shellCfg);
        results.LMTD = results.correctionFactor * LMTD_uncorrected;
      } else {
        results.correctionFactor = 1.0;
        results.LMTD = LMTD_uncorrected;
      }
    }

    // 🔥 Validity checks
    if (finalTh_out && finalTc_out && finalTh_in && finalTc_in) {
      if (flowType === "parallel" && finalTh_out < finalTc_out) {
        throw new Error(
          "Invalid result: Th_out must be greater than Tc_out in parallel flow."
        );
      }
      if (flowType === "counter" && finalTh_out < finalTc_in) {
        throw new Error(
          "Invalid result: Th_out must be greater than Tc_in in counter flow."
        );
      }
    }

    if (type === "performance") {
      const NTU = finalU && finalA && C_min ? (finalU * finalA) / C_min : null;
      const Cr = C_min && C_max ? C_min / C_max : 0.0;
      const Qmax =
        C_min && finalTh_in !== 0.0 && finalTc_in !== 0.0
          ? C_min * (finalTh_in - finalTc_in)
          : 0.0;

      let epsilonParallel = 0.0;
      let epsilonCounter = 0.0;
      let epsilonShell = 0.0;

      if (NTU !== 0.0 && Cr !== 0.0) {
        epsilonParallel = (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);

        epsilonCounter =
          Math.abs(Cr - 1) < 1e-6
            ? NTU / (1 + NTU)
            : (1 - Math.exp(-NTU * (1 - Cr))) /
              (1 - Cr * Math.exp(-NTU * (1 - Cr)));
      }

      const LMTD_parallel = computeLMTD(
        finalTh_in,
        finalTc_in,
        finalTh_out,
        finalTc_out,
        "parallel"
      );
      const LMTD_counter = computeLMTD(
        finalTh_in,
        finalTc_in,
        finalTh_out,
        finalTc_out,
        "counter"
      );

      let correctionFactorShell = 0.0;
      let LMTD_shell_corrected = 0.0;

      if (
        isNumber(finalTh_in) &&
        isNumber(finalTc_in) &&
        isNumber(finalTh_out) &&
        isNumber(finalTc_out) &&
        LMTD_counter
      ) {
        const P = (finalTc_out - finalTc_in) / (finalTh_in - finalTc_in);
        const R = (finalTh_in - finalTh_out) / (finalTc_out - finalTc_in);

        correctionFactorShell = calculateCorrectionFactor(P, R, shellConfig);

        if (correctionFactorShell) {
          LMTD_shell_corrected = correctionFactorShell * LMTD_counter;
        }
      }

      if (finalU && finalA && Qmax && LMTD_shell_corrected) {
        const Qshell = finalU * finalA * LMTD_shell_corrected;
        epsilonShell = Qshell / Qmax;
      }

      results.performance = {
        parallel: {
          epsilon: epsilonParallel,
          NTU,
          Cr,
          Qmax,
          LMTD_uncorrected: LMTD_parallel,
          LMTD: LMTD_parallel,
          correctionFactor: 1,
          thermalEfficiency: epsilonParallel ? epsilonParallel * 100 : null,
        },
        counter: {
          epsilon: epsilonCounter,
          NTU,
          Cr,
          Qmax,
          LMTD_uncorrected: LMTD_counter,
          LMTD: LMTD_counter,
          correctionFactor: 1,
          thermalEfficiency: epsilonCounter ? epsilonCounter * 100 : null,
        },
        shell: {
          epsilon: epsilonShell,
          NTU,
          Cr,
          Qmax,
          LMTD_uncorrected: LMTD_counter,
          LMTD: LMTD_shell_corrected,
          correctionFactor: correctionFactorShell,
          thermalEfficiency: epsilonShell ? epsilonShell * 100 : null,
        },
      };
    }
    return results;
  };

  const handleUnknownToggle = (paramId) => {
    const newUnknowns = new Set(selectedUnknowns);
    if (newUnknowns.has(paramId)) newUnknowns.delete(paramId);
    else if (newUnknowns.size < 5) newUnknowns.add(paramId);
    setSelectedUnknowns(newUnknowns);
    setInputs((prev) => {
      const newInputs = { ...prev };
      newUnknowns.forEach((u) => delete newInputs[u]);
      return newInputs;
    });
  };

  const handleInputChange = (paramId, value) => {
    setInputs((prev) => ({
      ...prev,
      [paramId]: value === "" ? null : parseFloat(value),
    }));
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (selectedUnknowns.size === 0) {
        setError("Please select at least one unknown parameter to calculate.");
        return;
      }
    }
    if (step === 2) {
      const requiredInputs =
        type === "performance"
          ? Array.from(
              new Set(
                Array.from(selectedUnknowns).flatMap(
                  (u) => performanceDependencies[u] || []
                )
              )
            )
              .map((id) => parameters.find((p) => p.id === id))
              .filter(Boolean)
          : parameters.filter((param) => !selectedUnknowns.has(param.id));
      for (const param of requiredInputs) {
        if (
          inputs[param.id] === null ||
          inputs[param.id] === undefined ||
          isNaN(inputs[param.id])
        ) {
          setError(`Please provide a valid numeric value for ${param.label}`);
          return;
        }
      }
      setRequiredKnowns(new Set(requiredInputs.map((p) => p.id)));
    }
    if (step === 3) {
      calculateHeatExchanger();
    }
    setStep(step + 1);
  };

  const handlePrevious = () => {
    setStep(Math.max(1, step - 1));
    setError(null);
  };

  const reset = () => {
    setStep(1);
    setSelectedUnknowns(new Set());
    setRequiredKnowns(new Set());
    setInputs({});
    setResults({});
    setError(null);
  };

  const getChartData = () => {
    const Th_in = results.Th_in || inputs.Th_in;
    const Tc_in = results.Tc_in || inputs.Tc_in;
    const Th_out = results.Th_out || inputs.Th_out;
    const Tc_out = results.Tc_out || inputs.Tc_out;
    if (!Th_in || !Tc_in || !Th_out || !Tc_out)
      return { labels: [], datasets: [] };
    const positions = Array.from({ length: 101 }, (_, i) => i);
    const hotTemps = positions.map(
      (pos) => Th_in - (Th_in - Th_out) * (pos / 100)
    );
    const coldTemps =
      type === "parallel"
        ? positions.map((pos) => Tc_in + (Tc_out - Tc_in) * (pos / 100))
        : positions.map((pos) => Tc_out - (Tc_out - Tc_in) * (pos / 100));
    return {
      labels: positions.map((pos) => `${pos}%`),
      datasets: [
        { label: "Hot Fluid", data: hotTemps, borderColor: "#ef4444" },
        { label: "Cold Fluid", data: coldTemps, borderColor: "#3b82f6" },
      ],
    };
  };

  const requiredInputs =
    type === "performance"
      ? Array.from(
          new Set(
            Array.from(selectedUnknowns).flatMap(
              (u) => performanceDependencies[u] || []
            )
          )
        )
          .map((id) => parameters.find((p) => p.id === id))
          .filter(Boolean)
      : parameters.filter((param) => !selectedUnknowns.has(param.id));

  return (
    <div
      className={`min-h-screen p-4 transition-colors ${
        theme === "light" ? "bg-gray-50" : "bg-gray-900"
      }`}
    >
      <div className="max-w-8xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-12">
          <h1
            className={`text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg transition-colors duration-300 ${
              theme === "light" ? "text-blue-700" : "text-blue-300"
            }`}
          >
            🔥 Heat Exchanger Calculator
          </h1>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 text-white text-lg font-semibold shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-2"
            >
              🚀 Back To Calculator
            </Link>

            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-3 rounded-2xl shadow-md transition-all duration-300 transform hover:scale-105 ${
                theme === "light"
                  ? "bg-gray-100 text-gray-800 hover:bg-gray-200 hover:shadow-lg"
                  : "bg-gray-800 text-yellow-300 hover:bg-gray-700 hover:shadow-lg"
              }`}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
        {error && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              theme === "light"
                ? "bg-red-100 text-red-800"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {error}
          </div>
        )}
        {step === 1 && (
          <div
            className={`${
              theme === "light" ? "bg-white" : "bg-gray-800"
            } p-6 rounded-xl shadow-lg`}
          >
            <h2
              className={`text-xl font-semibold mb-6 ${
                theme === "light" ? "text-gray-800" : "text-gray-200"
              }`}
            >
              {type === "performance"
                ? "Step 1: Select Performance Parameters to Calculate"
                : "Step 1: Select Unknowns to Calculate"}
            </h2>

            <div
              className={`grid ${
                type === "shell-tube" ? "md:grid-cols-2" : "md:grid-cols-1"
              } gap-6 mb-6`}
            >
              <div>
                <label
                  className={`block text-[22px] font-medium mb-2 ${
                    theme === "light" ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  Heat Exchanger Type
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    setSelectedUnknowns(new Set());
                    setType(e.target.value);
                  }}
                  className={`w-full p-3 text-[18px] border rounded-lg ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-gray-700 border-gray-600 text-gray-100"
                  }`}
                >
                  {exchangerTypes.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.label}
                    </option>
                  ))}
                </select>
              </div>

              {type === "shell-tube" && (
                <div>
                  <label
                    className={`block text-[22px] font-medium mb-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    Shell-Tube Configuration
                  </label>
                  <select
                    value={shellConfig}
                    onChange={(e) => setShellConfig(e.target.value)}
                    className={`w-full p-3 text-[18px] border rounded-lg ${
                      theme === "light"
                        ? "bg-white border-gray-300 text-gray-900"
                        : "bg-gray-700 border-gray-600 text-gray-100"
                    }`}
                  >
                    <option value="1-2">1 Shell Pass, 2 Tube Passes</option>
                    <option value="2-4">2 Shell Passes, 4 Tube Passes</option>
                    <option value="1-4">1 Shell Pass, 4 Tube Passes</option>
                    <option value="1-6">1 Shell Pass, 6 Tube Passes</option>
                  </select>
                </div>
              )}
            </div>

            {/* Unknowns OR Performance Parameters */}
            <div className="w-full">
              <h3 className="text-[22px] font-medium mb-3 text-orange-600">
                {type === "performance"
                  ? `Performance Parameters (${selectedUnknowns.size}/5)`
                  : `Unknown Parameters (${selectedUnknowns.size}/5)`}
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(type === "performance"
                  ? performanceParameters.filter(
                      (param) =>
                        param.id !== "Qmax" &&
                        param.id !== "Cr" &&
                        param.id !== "LMTD_uncorrected"
                    )
                  : parameters
                ).map((param) => (
                  <button
                    key={param.id}
                    type="button"
                    onClick={() => handleUnknownToggle(param.id)}
                    disabled={
                      selectedUnknowns.size >= 5 &&
                      !selectedUnknowns.has(param.id)
                    }
                    className={`p-3 rounded-lg border transition-all duration-200 flex items-center justify-center cursor-pointer font-medium
                ${
                  selectedUnknowns.has(param.id)
                    ? "bg-orange-600 text-white border-orange-600"
                    : theme === "light"
                    ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    : "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                }
                ${
                  selectedUnknowns.size >= 5 && !selectedUnknowns.has(param.id)
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                  >
                    {type === "performance"
                      ? `${param.label} (${param.unit})`
                      : getParameterLabel(param)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div
            className={`${
              theme === "light" ? "bg-white" : "bg-gray-900"
            } p-8 rounded-2xl shadow-xl transition-colors duration-300`}
          >
            <h2
              className={`text-2xl md:text-3xl font-bold mb-6 ${
                theme === "light" ? "text-gray-900" : "text-gray-100"
              } tracking-wide`}
            >
              {type === "performance"
                ? "Step 2: Enter Required Values for Performance Parameters"
                : "Step 2: Enter All Known Values"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requiredInputs.map((param) => (
                <div key={param.id}>
                  <label
                    className={`block text-sm md:text-base font-medium mb-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    {param.label} ({param.siUnit})
                  </label>
                  <input
                    type="number"
                    value={inputs[param.id] || ""}
                    onChange={(e) =>
                      handleInputChange(param.id, e.target.value)
                    }
                    className={`w-full p-3 rounded-lg border shadow-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500
              ${
                theme === "light"
                  ? "bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400 hover:bg-gray-50 focus:bg-white"
                  : "bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 hover:bg-gray-700 focus:bg-gray-700"
              }`}
                    placeholder="Enter value"
                    step="any"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            className={`${
              theme === "light" ? "bg-white" : "bg-gray-900"
            } p-8 rounded-2xl shadow-xl transition-colors duration-300`}
          >
            <h2
              className={`text-2xl md:text-3xl font-bold mb-6 ${
                theme === "light" ? "text-gray-900" : "text-gray-100"
              } tracking-wide`}
            >
              Step 3: Review and Calculate
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {/* ✅ Known Values */}
              <div>
                <h3 className="text-xl font-semibold mb-4 text-green-600 uppercase tracking-wide">
                  Known Values
                </h3>
                <div className="space-y-3">
                  {Array.from(requiredKnowns).map((paramId) => {
                    const param =
                      parameters.find((p) => p.id === paramId) ||
                      performanceParameters.find((p) => p.id === paramId);

                    if (!param) return null;

                    return (
                      <div
                        key={paramId}
                        className={`text-sm md:text-base p-3 rounded-lg transition-all duration-200 ${
                          theme === "light"
                            ? "bg-gray-100 text-gray-800 hover:bg-green-50"
                            : "bg-gray-800 text-gray-200 hover:bg-green-900"
                        } shadow-sm hover:shadow-md`}
                      >
                        <span className="font-medium">{param.label}:</span>{" "}
                        <span className="ml-1">
                          {inputs[paramId] ?? "Not set"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ✅ Will Calculate */}
              <div>
                <h3 className="text-xl font-semibold mb-4 text-orange-500 uppercase tracking-wide">
                  Will Calculate
                </h3>
                <div className="space-y-3">
                  {Array.from(selectedUnknowns).map((paramId) => {
                    const param =
                      parameters.find((p) => p.id === paramId) ||
                      performanceParameters.find((p) => p.id === paramId);

                    if (!param) return null;

                    return (
                      <div
                        key={paramId}
                        className={`text-sm md:text-base p-3 rounded-lg transition-all duration-200 ${
                          theme === "light"
                            ? "bg-gray-100 text-gray-800 hover:bg-orange-50"
                            : "bg-gray-800 text-gray-200 hover:bg-orange-900"
                        } shadow-sm hover:shadow-md`}
                      >
                        {param.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div
              className={`${
                theme === "light" ? "bg-white" : "bg-gray-800"
              } p-6 rounded-xl shadow-lg`}
            >
              <h2
                className={`text-3xl font-extrabold mb-6 ${
                  theme === "light" ? "text-gray-900" : "text-gray-100"
                }`}
              >
                🔥 Calculation Results
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {type === "performance" && results?.performance ? (
                  <>
                    {Object.entries(results.performance).map(
                      ([flowType, flowResults]) => (
                        <div
                          key={flowType}
                          className={`p-8 rounded-3xl shadow-xl transition-transform duration-300 transform hover:scale-105 hover:shadow-2xl ${
                            theme === "light"
                              ? "bg-gradient-to-br from-white via-blue-50 to-white"
                              : "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
                          }`}
                        >
                          <h3
                            className={`text-2xl font-bold mb-6 tracking-wide ${
                              theme === "light"
                                ? "text-blue-700"
                                : "text-blue-300"
                            }`}
                          >
                            {flowType === "shell-tube"
                              ? "Shell-and-Tube Flow"
                              : flowType.charAt(0).toUpperCase() +
                                flowType.slice(1) +
                                " Flow"}
                          </h3>

                          <ul className="space-y-3">
                            {Object.entries(flowResults)
                              .filter(
                                ([param]) =>
                                  selectedUnknowns.has(param) ||
                                  (selectedUnknowns.has("LMTD") &&
                                    param === "LMTD_uncorrected") ||
                                  param === "Cr" ||
                                  param === "Qmax"
                              )
                              .map(([param, value]) => {
                                const paramInfo =
                                  performanceParameters.find(
                                    (p) => p.id === param
                                  ) || parameters.find((p) => p.id === param);

                                return (
                                  <li
                                    key={param}
                                    className={`flex justify-between items-center text-sm font-medium p-3 rounded-xl transition-colors duration-200 ${
                                      theme === "light"
                                        ? "bg-blue-50 hover:bg-blue-100"
                                        : "bg-gray-700 hover:bg-gray-600/50"
                                    }`}
                                  >
                                    <span
                                      className={`font-semibold ${
                                        theme === "light"
                                          ? "text-gray-800"
                                          : "text-gray-200"
                                      }`}
                                    >
                                      {paramInfo ? paramInfo.label : param}:
                                    </span>
                                    <span
                                      className={`text-[15px] font-semibold mr-5 flex items-baseline space-x-1 ${
                                        theme === "light"
                                          ? "text-gray-900"
                                          : "text-gray-300"
                                      }`}
                                    >
                                      <span>
                                        {typeof value === "number"
                                          ? value.toFixed(4)
                                          : value}
                                      </span>
                                      {paramInfo?.unit && (
                                        <span
                                          className={`text-[15px] ${
                                            theme === "light"
                                              ? "text-gray-800"
                                              : "text-gray-200"
                                          }`}
                                        >
                                          {paramInfo.unit}
                                        </span>
                                      )}
                                    </span>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <>
                    {Array.from(selectedUnknowns).map((paramId) => {
                      const param =
                        parameters.find((p) => p.id === paramId) ||
                        performanceParameters.find((p) => p.id === paramId);

                      if (!param) return null;
                      const value = results[paramId];
                      return (
                        <div
                          key={paramId}
                          className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                            theme === "light" ? "bg-blue-50" : "bg-blue-900/30"
                          }`}
                        >
                          <h4
                            className={`text-xl font-semibold mb-2 ${
                              theme === "light"
                                ? "text-blue-800"
                                : "text-blue-200"
                            }`}
                          >
                            {param.label}
                          </h4>
                          <p
                            className={`text-2xl font-bold mb-1 ${
                              theme === "light"
                                ? "text-gray-900"
                                : "text-gray-100"
                            }`}
                          >
                            {value !== null && value !== undefined
                              ? value.toFixed(4)
                              : "N/A"}
                          </p>
                          <p
                            className={`text-sm ${
                              theme === "light"
                                ? "text-gray-600"
                                : "text-gray-400"
                            }`}
                          >
                            {param.siUnit || param.unit}
                          </p>
                        </div>
                      );
                    })}
                    {(results.epsilon !== undefined ||
                      results.NTU !== undefined ||
                      results.LMTD !== undefined ||
                      results.Qmax !== undefined ||
                      results.Cr !== undefined ||
                      results.thermalEfficiency !== undefined) && (
                      <>
                        <div className="col-span-full mt-4">
                          <h3
                            className={`text-2xl font-bold mb-4 ${
                              theme === "light"
                                ? "text-gray-900"
                                : "text-gray-100"
                            }`}
                          >
                            ⚡ Performance Parameters
                          </h3>
                        </div>

                        {results.epsilon !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light"
                                ? "bg-green-50"
                                : "bg-green-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-green-800"
                                  : "text-green-200"
                              }`}
                            >
                              Effectiveness (ε)
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.epsilon.toFixed(4)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              Dimensionless
                            </p>
                          </div>
                        )}

                        {results.thermalEfficiency !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light"
                                ? "bg-yellow-50"
                                : "bg-yellow-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-yellow-800"
                                  : "text-yellow-200"
                              }`}
                            >
                              Thermal Efficiency
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.thermalEfficiency.toFixed(2)}%
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              Percentage of maximum possible heat transfer
                            </p>
                          </div>
                        )}

                        {results.NTU !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light"
                                ? "bg-green-50"
                                : "bg-green-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-green-800"
                                  : "text-green-200"
                              }`}
                            >
                              Number of Transfer Units (NTU)
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.NTU.toFixed(4)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              Dimensionless
                            </p>
                          </div>
                        )}

                        {results.Cr !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light"
                                ? "bg-blue-50"
                                : "bg-blue-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-blue-800"
                                  : "text-blue-200"
                              }`}
                            >
                              Capacity Ratio (Cr)
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.Cr.toFixed(4)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              Dimensionless
                            </p>
                          </div>
                        )}

                        {results.Qmax !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light" ? "bg-red-50" : "bg-red-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-red-800"
                                  : "text-red-200"
                              }`}
                            >
                              Maximum Heat Transfer Rate (Qmax)
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.Qmax.toFixed(2)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              Watts (W)
                            </p>
                          </div>
                        )}

                        {results.LMTD !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light"
                                ? "bg-green-50"
                                : "bg-green-900/30"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-green-800"
                                  : "text-green-200"
                              }`}
                            >
                              Log Mean Temperature Difference
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.LMTD.toFixed(4)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              °C (Corrected)
                            </p>
                          </div>
                        )}

                        {results.correctionFactor !== undefined &&
                          results.correctionFactor !== 1 && (
                            <div
                              className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                                theme === "light"
                                  ? "bg-purple-50"
                                  : "bg-purple-900/30"
                              }`}
                            >
                              <h4
                                className={`text-xl font-semibold mb-2 ${
                                  theme === "light"
                                    ? "text-purple-800"
                                    : "text-purple-200"
                                }`}
                              >
                                LMTD Correction Factor (F)
                              </h4>
                              <p
                                className={`text-2xl font-bold mb-1 ${
                                  theme === "light"
                                    ? "text-gray-900"
                                    : "text-gray-100"
                                }`}
                              >
                                {results.correctionFactor.toFixed(4)}
                              </p>
                              <p
                                className={`text-sm ${
                                  theme === "light"
                                    ? "text-gray-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {shellConfig} Configuration
                              </p>
                            </div>
                          )}

                        {results.LMTD_uncorrected !== undefined && (
                          <div
                            className={`p-5 rounded-xl shadow-md transition-transform transform hover:scale-105 ${
                              theme === "light" ? "bg-gray-50" : "bg-gray-700"
                            }`}
                          >
                            <h4
                              className={`text-xl font-semibold mb-2 ${
                                theme === "light"
                                  ? "text-gray-800"
                                  : "text-gray-200"
                              }`}
                            >
                              LMTD (Uncorrected)
                            </h4>
                            <p
                              className={`text-2xl font-bold mb-1 ${
                                theme === "light"
                                  ? "text-gray-900"
                                  : "text-gray-100"
                              }`}
                            >
                              {results.LMTD_uncorrected.toFixed(4)}
                            </p>
                            <p
                              className={`text-sm ${
                                theme === "light"
                                  ? "text-gray-600"
                                  : "text-gray-400"
                              }`}
                            >
                              °C (Pure Counter-flow)
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div
              className={`mt-6 ${
                theme === "light" ? "bg-white" : "bg-gray-800"
              } p-6 rounded-xl shadow-lg`}
            >
              <h3
                className={`text-lg font-semibold mb-4 ${
                  theme === "light" ? "text-gray-800" : "text-gray-200"
                }`}
              >
                Temperature Profile
              </h3>
              <div className="h-96">
                <Line
                  data={getChartData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "top",
                        labels: {
                          color: theme === "light" ? "#1f2937" : "#e5e7eb",
                        },
                      },
                      title: {
                        display: true,
                        text: `Temperature Profile - ${
                          type === "counter" ? "Counter" : "Parallel"
                        } Flow`,
                        color: theme === "light" ? "#1f2937" : "#e5e7eb",
                        font: { size: 16, weight: "bold" },
                      },
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Position Along Heat Exchanger (%)",
                          color: theme === "light" ? "#1f2937" : "#e5e7eb",
                        },
                        ticks: {
                          color: theme === "light" ? "#4b5563" : "#9ca3af",
                          maxTicksLimit: 11,
                        },
                      },
                      y: {
                        title: {
                          display: true,
                          text: `Temperature (°C)`,
                          color: theme === "light" ? "#1f2937" : "#e5e7eb",
                        },
                        ticks: {
                          color: theme === "light" ? "#4b5563" : "#9ca3af",
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          {step > 1 && (
            <button
              onClick={handlePrevious}
              className={`flex-1 px-6 py-3 font-bold text-[20px] rounded-xl shadow-md transition-all transform hover:scale-102 hover:shadow-xl ${
                theme === "light"
                  ? "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800 hover:from-gray-400 hover:to-gray-500"
                  : "bg-gradient-to-r from-gray-700 to-gray-600 text-gray-200 hover:from-gray-600 hover:to-gray-500"
              }`}
            >
              ← Previous
            </button>
          )}

          {step < 4 && (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 font-bold text-[20px] rounded-xl shadow-md transition-all transform hover:scale-102 hover:shadow-xl text-white bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
            >
              {step === 3 ? "Calculate 🔥" : "Next →"}
            </button>
          )}

          {step === 4 && (
            <button
              onClick={reset}
              className="flex-1 px-6 py-3 font-bold text-[20px] rounded-xl shadow-md transition-all transform hover:scale-102 hover:shadow-xl text-white bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
            >
              New Calculation ♻️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

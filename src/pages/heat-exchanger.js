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
  const [unit, setUnit] = useState("SI");
  const [theme, setTheme] = useState("light");
  const [selectedUnknowns, setSelectedUnknowns] = useState(new Set());
  const [requiredKnowns, setRequiredKnowns] = useState(new Set());
  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  const parameters = useMemo(
    () => [
      {
        id: "Th_in",
        label: "Hot Inlet Temperature",
        siUnit: "°C",
        impUnit: "°F",
      },
      {
        id: "Tc_in",
        label: "Cold Inlet Temperature",
        siUnit: "°C",
        impUnit: "°F",
      },
      {
        id: "Th_out",
        label: "Hot Outlet Temperature",
        siUnit: "°C",
        impUnit: "°F",
      },
      {
        id: "Tc_out",
        label: "Cold Outlet Temperature",
        siUnit: "°C",
        impUnit: "°F",
      },
      {
        id: "m_h",
        label: "Hot Mass Flow Rate",
        siUnit: "kg/s",
        impUnit: "lb/s",
      },
      {
        id: "m_c",
        label: "Cold Mass Flow Rate",
        siUnit: "kg/s",
        impUnit: "lb/s",
      },
      {
        id: "cp_h",
        label: "Hot Specific Heat",
        siUnit: "J/kg·K",
        impUnit: "BTU/lb·°F",
      },
      {
        id: "cp_c",
        label: "Cold Specific Heat",
        siUnit: "J/kg·K",
        impUnit: "BTU/lb·°F",
      },
      { id: "A", label: "Heat Transfer Area", siUnit: "m²", impUnit: "ft²" },
      {
        id: "U",
        label: "Overall Heat Transfer Coefficient",
        siUnit: "W/m²·K",
        impUnit: "BTU/hr·ft²·°F",
      },
      { id: "Q", label: "Heat Transfer Rate", siUnit: "W", impUnit: "BTU/hr" },
    ],
    []
  );

  const getParameterLabel = (param) => {
    const currentUnit = unit === "SI" ? param.siUnit : param.impUnit;
    return `${param.label} (${currentUnit})`;
  };

  const convertToSI = (value, paramId) => {
    if (value === null || value === undefined || unit === "SI") return value;
    switch (paramId) {
      case "Th_in":
      case "Tc_in":
      case "Th_out":
      case "Tc_out":
        return (value - 32) * (5 / 9);
      case "m_h":
      case "m_c":
        return value / 2.20462;
      case "cp_h":
      case "cp_c":
        return value * 4186.8;
      case "A":
        return value / 10.76391;
      case "U":
        return value * 5.678;
      case "Q":
        return value / 3.41214;
      default:
        return value;
    }
  };

  const convertFromSI = (value, paramId) => {
    if (value === null || value === undefined || unit === "SI") return value;
    switch (paramId) {
      case "Th_in":
      case "Tc_in":
      case "Th_out":
      case "Tc_out":
        return value * (9 / 5) + 32;
      case "m_h":
      case "m_c":
        return value * 2.20462;
      case "cp_h":
      case "cp_c":
        return value / 4186.8;
      case "A":
        return value * 10.76391;
      case "U":
        return value / 5.678;
      case "Q":
        return value * 3.41214;
      default:
        return value;
    }
  };

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
          const P1 =
            (2 / R) *
            (1 - Math.sqrt(R * R + 1) / Math.tanh(Math.sqrt(R * R + 1) / 2));
          if (P <= P1) return calculateCorrectionFactor(P, R, "1-2");
          if (Math.abs(R - 1) < 1e-6) {
            const P2 = P / 2;
            const F =
              (Math.sqrt(2) * (1 - P2)) /
              (P2 *
                Math.log(
                  (2 - P2 * (1 + 1 / Math.sqrt(2))) /
                    (2 - P2 * (1 - 1 / Math.sqrt(2)))
                ));
            return isFinite(F) ? F : 1;
          }
          const S2 = Math.sqrt(R * R + 1) / (R - 1);
          const W2 = Math.pow((1 - P) / (1 - P * R), 1 / 4);
          if (Math.abs(W2 - 1) < 1e-6) return 1;
          const arg2 = (1 + W2 - S2 + S2 * W2) / (1 + W2 + S2 - S2 * W2);
          if (arg2 <= 0) return 1;
          const F2 = (S2 * Math.log(W2)) / Math.log(arg2);
          return isFinite(F2) && F2 > 0 ? F2 : 1;
        case "1-4":
          const S3 = Math.sqrt(R * R + 1) / (R - 1);
          const W3 = Math.pow((1 - P) / (1 - P * R), 1 / 4);
          if (Math.abs(W3 - 1) < 1e-6) return 1;
          const arg3 = (1 + W3 - S3 + S3 * W3) / (1 + W3 + S3 - S3 * W3);
          if (arg3 <= 0) return 1;
          const F3 = (S3 * Math.log(W3)) / (2 * Math.log(arg3));
          return isFinite(F3) && F3 > 0 ? F3 : 1;
        case "1-6":
          const S4 = Math.sqrt(R * R + 1) / (R - 1);
          const W4 = Math.pow((1 - P) / (1 - P * R), 1 / 6);
          if (Math.abs(W4 - 1) < 1e-6) return 1;
          const arg4 = (1 + W4 - S4 + S4 * W4) / (1 + W4 + S4 - S4 * W4);
          if (arg4 <= 0) return 1;
          const F4 = (S4 * Math.log(W4)) / (3 * Math.log(arg4));
          return isFinite(F4) && F4 > 0 ? F4 : 1;
        case "counter":
        case "parallel":
        default:
          return 1;
      }
    } catch (error) {
      return 1;
    }
  };

  const calculateHeatExchanger = () => {
    setError(null);
    const siInputs = {};
    for (const [key, value] of Object.entries(inputs)) {
      siInputs[key] = convertToSI(value, key);
    }
    try {
      const calculated = solveHeatExchanger(
        siInputs,
        requiredKnowns,
        selectedUnknowns,
        type,
        shellConfig
      );
      const displayResults = {};
      for (const [key, value] of Object.entries(calculated)) {
        displayResults[key] = convertFromSI(value, key);
      }
      setResults(displayResults);
    } catch (err) {
      setError(
        `Calculation failed: ${err.message}. Received inputs: ${JSON.stringify(
          siInputs
        )}`
      );
    }
  };

  const solveHeatExchanger = (
    siInputs,
    knowns,
    unknowns,
    flowType,
    shellConfig
  ) => {
    const knownArray = Array.from(knowns);
    const unknownArray = Array.from(unknowns);

    if (knownArray.length === 0)
      throw new Error("No valid known parameters provided.");
    if (unknownArray.length === 0)
      throw new Error("Select at least one unknown parameter.");

    const known = {};
    knownArray.forEach((param) => {
      known[param] = siInputs[param];
      if (
        known[param] === null ||
        known[param] === undefined ||
        isNaN(known[param])
      ) {
        throw new Error(
          `Missing or invalid value for ${
            parameters.find((p) => p.id === param)?.label || param
          }`
        );
      }
    });

    const results = { ...known };

    let C_h = known.m_h && known.cp_h ? known.m_h * known.cp_h : null;
    let C_c = known.m_c && known.cp_c ? known.m_c * known.cp_c : null;
    let C_min = C_h && C_c ? Math.min(C_h, C_c) : null;
    let C_max = C_h && C_c ? Math.max(C_h, C_c) : null;
    let Cr = C_min && C_max ? C_min / C_max : null;

    const computeLMTD = (Th_in, Tc_in, Th_out, Tc_out) => {
      let dt1, dt2;
      if (flowType === "parallel") {
        dt1 = Th_in - Tc_in;
        dt2 = Th_out - Tc_out;
      } else {
        dt1 = Th_in - Tc_out;
        dt2 = Th_out - Tc_in;
      }
      if (Math.abs(dt1 - dt2) < 1e-6) return dt1;
      if (dt1 <= 0 || dt2 <= 0)
        throw new Error(
          "Invalid temperature differences: ensure Th_in > Tc_out and Th_out > Tc_in for the given flow type."
        );
      return (dt1 - dt2) / Math.log(dt1 / dt2);
    };

    const computeEffectiveness = (NTU, Cr, flowType) => {
      if (!NTU || !Cr) return null;
      if (flowType === "counter") {
        if (Math.abs(Cr - 1) < 1e-6) return NTU / (1 + NTU);
        return (
          (1 - Math.exp(-NTU * (1 - Cr))) / (1 - Cr * Math.exp(-NTU * (1 - Cr)))
        );
      } else if (flowType === "parallel") {
        return (1 - Math.exp(-NTU * (1 + Cr))) / (1 + Cr);
      }
      return null;
    };

    const iterateQ = (
      Th_in,
      Tc_in,
      C_h,
      C_c,
      U,
      A,
      maxIter = 100,
      tol = 0.01
    ) => {
      let Q = C_min * (Th_in - Tc_in) * 0.5;
      for (let i = 0; i < maxIter; i++) {
        const Th_out = Th_in - Q / C_h;
        const Tc_out = Tc_in + Q / C_c;
        const lmtd = computeLMTD(Th_in, Tc_in, Th_out, Tc_out);
        const F =
          shellConfig !== "counter" && shellConfig !== "parallel"
            ? calculateCorrectionFactor(
                (Tc_out - Tc_in) / (Th_in - Tc_in),
                (Th_in - Th_out) / (Tc_out - Tc_in),
                shellConfig
              )
            : 1;
        const Q_calc = U * A * lmtd * F;
        if (Math.abs(Q_calc - Q) < tol) return Q;
        Q = Q_calc;
      }
      throw new Error(
        "Iteration failed to converge for heat transfer rate. Check input values and configuration."
      );
    };

    const dependencyMap = {
      Q: [
        ["Tc_in", "Tc_out", "m_c", "cp_c"],
        ["Th_in", "Th_out", "m_h", "cp_h"],
      ],
      Th_out: [
        ["Q", "Th_in", "m_h", "cp_h"],
        ["Tc_in", "Tc_out", "m_c", "cp_c", "m_h", "cp_h", "U", "A"],
      ],
      Tc_out: [
        ["Q", "Tc_in", "m_c", "cp_c"],
        ["Th_in", "Th_out", "m_h", "cp_h", "m_c", "cp_c", "U", "A"],
      ],
      A: [["Q", "U", "Th_in", "Tc_in", "Th_out", "Tc_out"]],
    };

    // Iterative calculation prioritizing hot side and ensuring Tc_out and A
    const calculateInterdependentUnknowns = () => {
      // Calculate Q using hot side first if available
      if (unknownArray.includes("Q") && known.Th_in && known.Th_out && C_h) {
        results.Q = C_h * (known.Th_in - known.Th_out);
      }
      // Fall back to cold side if hot side data is incomplete
      else if (
        unknownArray.includes("Q") &&
        known.Tc_in &&
        known.Tc_out &&
        C_c
      ) {
        results.Q = C_c * (known.Tc_out - known.Tc_in);
      }

      // Calculate Tc_out using Q from hot side
      if (unknownArray.includes("Tc_out") && results.Q && known.Tc_in && C_c) {
        results.Tc_out = known.Tc_in + results.Q / C_c;
      }

      // Calculate Th_out if needed (though already known in this case)
      if (unknownArray.includes("Th_out") && results.Q && known.Th_in && C_h) {
        results.Th_out = known.Th_in - results.Q / C_h;
      }

      // Calculate A using Q, U, and LMTD
      if (
        unknownArray.includes("A") &&
        results.Q &&
        known.U &&
        known.Th_in &&
        known.Tc_in &&
        known.Th_out &&
        results.Tc_out
      ) {
        const lmtd = computeLMTD(
          known.Th_in,
          known.Tc_in,
          known.Th_out,
          results.Tc_out
        );
        if (lmtd > 0) {
          results.A = results.Q / (known.U * lmtd);
        } else {
          throw new Error("LMTD is zero or negative, cannot compute A.");
        }
      }
    };

    calculateInterdependentUnknowns();

    if (
      unknownArray.includes("Th_out") &&
      unknownArray.includes("Tc_out") &&
      !unknownArray.includes("A") &&
      !unknownArray.includes("Q")
    ) {
      if (known.Th_in && known.Tc_in && C_h && C_c && known.U && known.A) {
        const NTU = (known.U * known.A) / C_min;
        const epsilon = computeEffectiveness(NTU, Cr, flowType);
        if (epsilon) {
          const Q = epsilon * C_min * (known.Th_in - known.Tc_in);
          results.Q = Q;
          results.Th_out = known.Th_in - Q / C_h;
          results.Tc_out = known.Tc_in + Q / C_c;
        } else if (shellConfig !== "counter" && shellConfig !== "parallel") {
          results.Q = iterateQ(
            known.Th_in,
            known.Tc_in,
            C_h,
            C_c,
            known.U,
            known.A
          );
          results.Th_out = known.Th_in - results.Q / C_h;
          results.Tc_out = known.Tc_in + results.Q / C_c;
        }
      } else {
        throw new Error(
          "Need Th_in, Tc_in, m_h, cp_h, m_c, cp_c, U, A to calculate both outlets."
        );
      }
    }

    const finalQ =
      results.Q ||
      known.Q ||
      (known.Th_in && known.Th_out && C_h
        ? C_h * (known.Th_in - known.Th_out)
        : known.Tc_in && known.Tc_out && C_c
        ? C_c * (known.Tc_out - known.Tc_in)
        : null);
    const finalTh_in =
      known.Th_in ||
      (known.Tc_out && results.Tc_out ? known.Tc_out + 20 : null);
    const finalTc_in =
      known.Tc_in ||
      (known.Th_out && results.Th_out ? known.Th_out - 20 : null);
    const finalTh_out = results.Th_out || known.Th_out;
    const finalTc_out = results.Tc_out || known.Tc_out;
    const finalA = results.A || known.A;
    const finalU = known.U;

    if (finalQ && C_min && finalTh_in && finalTc_in) {
      results.epsilon = finalQ / (C_min * (finalTh_in - finalTc_in));
    }

    if (finalU && finalA && C_min) {
      results.NTU = (finalU * finalA) / C_min;
    }

    if (finalTh_in && finalTc_in && finalTh_out && finalTc_out) {
      const LMTD_uncorrected = computeLMTD(
        finalTh_in,
        finalTc_in,
        finalTh_out,
        finalTc_out
      );
      results.LMTD_uncorrected = LMTD_uncorrected;

      if (shellConfig !== "counter" && shellConfig !== "parallel") {
        const P = (finalTc_out - finalTc_in) / (finalTh_in - finalTc_in);
        const R = (finalTh_in - finalTh_out) / (finalTc_out - finalTc_in);
        results.correctionFactor = calculateCorrectionFactor(P, R, shellConfig);
        results.LMTD = results.correctionFactor * LMTD_uncorrected;
      } else {
        results.correctionFactor = 1.0;
        results.LMTD = LMTD_uncorrected;
      }
    }

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

    return results;
  };

  const dependencyMap = {
    Q: [
      ["Tc_in", "Tc_out", "m_c", "cp_c"],
      ["Th_in", "Th_out", "m_h", "cp_h"],
    ],
    Th_out: [
      ["Q", "Th_in", "m_h", "cp_h"],
      ["Tc_in", "Tc_out", "m_c", "cp_c", "m_h", "cp_h", "U", "A"],
    ],
    Tc_out: [
      ["Q", "Tc_in", "m_c", "cp_c"],
      ["Th_in", "Th_out", "m_h", "cp_h", "m_c", "cp_c", "U", "A"],
    ],
    A: [["Q", "U", "Th_in", "Tc_in", "Th_out", "Tc_out"]],
  };

  const determineRequiredKnowns = (unknowns) => {
    const required = new Set();
    const allKnowns = new Set(
      parameters.map((p) => p.id).filter((id) => !unknowns.has(id))
    );
    unknowns.forEach((u) => {
      const deps = dependencyMap[u];
      if (deps) {
        for (const depSet of deps) {
          const includesUnknown = depSet.some((dep) => unknowns.has(dep));
          if (!includesUnknown) {
            depSet.forEach((d) => required.add(d));
            break;
          }
        }
      }
    });
    allKnowns.forEach((param) => required.add(param));
    unknowns.forEach((u) => required.delete(u));
    return required;
  };

  const handleUnknownToggle = (paramId) => {
    const newUnknowns = new Set(selectedUnknowns);
    if (newUnknowns.has(paramId)) {
      newUnknowns.delete(paramId);
    } else if (newUnknowns.size < 4) {
      newUnknowns.add(paramId);
    }
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
      const nonUnknowns = parameters.filter(
        (param) => !selectedUnknowns.has(param.id)
      );
      for (const param of nonUnknowns) {
        if (
          inputs[param.id] === null ||
          inputs[param.id] === undefined ||
          isNaN(inputs[param.id])
        ) {
          setError(`Please provide a valid numeric value for ${param.label}`);
          return;
        }
        if (
          inputs[param.id] < 0 &&
          ["m_h", "m_c", "cp_h", "cp_c", "A", "U", "Q"].includes(param.id)
        ) {
          setError(`Value for ${param.label} must be non-negative`);
          return;
        }
        if (
          (param.id === "Th_in" || param.id === "Th_out") &&
          inputs[param.id] < inputs.Tc_in &&
          inputs.Tc_in !== undefined
        ) {
          setError(
            `${param.label} must be greater than Cold Inlet Temperature (${
              inputs.Tc_in
            } ${unit === "SI" ? "°C" : "°F"})`
          );
          return;
        }
        if (
          (param.id === "Tc_in" || param.id === "Tc_out") &&
          inputs[param.id] > inputs.Th_in &&
          inputs.Th_in !== undefined
        ) {
          setError(
            `${param.label} must be less than Hot Inlet Temperature (${
              inputs.Th_in
            } ${unit === "SI" ? "°C" : "°F"})`
          );
          return;
        }
      }
      setRequiredKnowns(determineRequiredKnowns(selectedUnknowns));
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
    const hotTemps = positions.map((pos) => {
      const fraction = pos / 100;
      return Th_in - (Th_in - Th_out) * fraction;
    });
    let coldTemps;
    if (type === "parallel") {
      coldTemps = positions.map((pos) => {
        const fraction = pos / 100;
        return Tc_in + (Tc_out - Tc_in) * fraction;
      });
    } else {
      coldTemps = positions.map((pos) => {
        const fraction = pos / 100;
        return Tc_out - (Tc_out - Tc_in) * fraction;
      });
    }
    return {
      labels: positions.map((pos) => `${pos}%`),
      datasets: [
        {
          label: "Hot Fluid",
          data: hotTemps,
          borderColor: "#ef4444",
          backgroundColor: "#ef4444",
          fill: false,
          tension: 0.1,
        },
        {
          label: "Cold Fluid",
          data: coldTemps,
          borderColor: "#3b82f6",
          backgroundColor: "#3b82f6",
          fill: false,
          tension: 0.1,
        },
      ],
    };
  };

  return (
    <div
      className={`min-h-screen p-4 transition-colors ${
        theme === "light" ? "bg-gray-50" : "bg-gray-900"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-10">
          <h1
            className={`text-4xl font-extrabold tracking-tight drop-shadow-sm ${
              theme === "light" ? "text-blue-700" : "text-blue-300"
            }`}
          >
            🔥 Heat Exchanger Calculator
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold shadow-lg hover:scale-105 hover:shadow-2xl transition-transform duration-200 flex items-center justify-center gap-2"
            >
              🚀 Back To Calculator
            </Link>
            <button
              onClick={() => setUnit(unit === "SI" ? "Imperial" : "SI")}
              className="px-5 py-3 rounded-xl bg-blue-600 text-white font-medium shadow-md hover:bg-blue-700 hover:shadow-lg transition"
            >
              {unit} Units
            </button>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`p-3 rounded-xl shadow-md transition ${
                theme === "light"
                  ? "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  : "bg-gray-800 text-yellow-300 hover:bg-gray-700"
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
              className={`text-xl font-semibold mb-4 ${
                theme === "light" ? "text-gray-800" : "text-gray-200"
              }`}
            >
              Step 1: Select Unknowns to Calculate
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === "light" ? "text-gray-700" : "text-gray-300"
                  }`}
                >
                  Heat Exchanger Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`w-full p-3 border rounded-lg ${
                    theme === "light"
                      ? "bg-white border-gray-300 text-gray-900"
                      : "bg-gray-700 border-gray-600 text-gray-100"
                  }`}
                >
                  <option value="counter">Counter Flow</option>
                  <option value="parallel">Parallel Flow</option>
                  <option value="shell-tube">Shell and Tube</option>
                </select>
              </div>
              {type === "shell-tube" && (
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === "light" ? "text-gray-700" : "text-gray-300"
                    }`}
                  >
                    Shell-Tube Configuration
                  </label>
                  <select
                    value={shellConfig}
                    onChange={(e) => setShellConfig(e.target.value)}
                    className={`w-full p-3 border rounded-lg ${
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
              <div>
                <h3 className="text-lg font-medium mb-3 text-orange-600">
                  Unknown Parameters ({selectedUnknowns.size}/4)
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {parameters.map((param) => (
                    <label
                      key={param.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUnknowns.has(param.id)}
                        onChange={() => handleUnknownToggle(param.id)}
                        disabled={
                          selectedUnknowns.size >= 4 &&
                          !selectedUnknowns.has(param.id)
                        }
                        className="h-4 w-4 text-orange-600 rounded"
                      />
                      <span
                        className={`text-sm ${
                          selectedUnknowns.size >= 4 &&
                          !selectedUnknowns.has(param.id)
                            ? "text-gray-400"
                            : theme === "light"
                            ? "text-gray-700"
                            : "text-gray-300"
                        }`}
                      >
                        {getParameterLabel(param)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div
            className={`${
              theme === "light" ? "bg-white" : "bg-gray-800"
            } p-6 rounded-xl shadow-lg`}
          >
            <h2
              className={`text-xl font-semibold mb-4 ${
                theme === "light" ? "text-gray-800" : "text-gray-200"
              }`}
            >
              Step 2: Enter All Known Values
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parameters
                .filter((param) => !selectedUnknowns.has(param.id))
                .map((param) => (
                  <div key={param.id}>
                    <label
                      className={`block text-sm font-medium mb-2 ${
                        theme === "light" ? "text-gray-700" : "text-gray-300"
                      }`}
                    >
                      {getParameterLabel(param)}
                    </label>
                    <input
                      type="number"
                      value={inputs[param.id] || ""}
                      onChange={(e) =>
                        handleInputChange(param.id, e.target.value)
                      }
                      className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        theme === "light"
                          ? "bg-white border-gray-300 text-gray-900"
                          : "bg-gray-700 border-gray-600 text-gray-100"
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
              theme === "light" ? "bg-white" : "bg-gray-800"
            } p-6 rounded-xl shadow-lg`}
          >
            <h2
              className={`text-xl font-semibold mb-4 ${
                theme === "light" ? "text-gray-800" : "text-gray-200"
              }`}
            >
              Step 3: Review and Calculate
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium mb-3 text-green-600">
                  Known Values
                </h3>
                <div className="space-y-2">
                  {Array.from(requiredKnowns).map((paramId) => {
                    const param = parameters.find((p) => p.id === paramId);
                    return (
                      <div
                        key={paramId}
                        className={`text-sm ${
                          theme === "light" ? "text-gray-700" : "text-gray-300"
                        }`}
                      >
                        {param.label}: {inputs[paramId] || "Not set"}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 text-orange-600">
                  Will Calculate
                </h3>
                <div className="space-y-2">
                  {Array.from(selectedUnknowns).map((paramId) => {
                    const param = parameters.find((p) => p.id === paramId);
                    return (
                      <div
                        key={paramId}
                        className={`text-sm ${
                          theme === "light" ? "text-gray-700" : "text-gray-300"
                        }`}
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
                className={`text-xl font-semibold mb-4 ${
                  theme === "light" ? "text-gray-800" : "text-gray-200"
                }`}
              >
                Calculation Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(selectedUnknowns).map((paramId) => {
                  const param = parameters.find((p) => p.id === paramId);
                  const value = results[paramId];
                  return (
                    <div
                      key={paramId}
                      className={`p-4 rounded-lg ${
                        theme === "light" ? "bg-blue-50" : "bg-blue-900/30"
                      }`}
                    >
                      <h4
                        className={`font-medium ${
                          theme === "light" ? "text-blue-800" : "text-blue-200"
                        }`}
                      >
                        {param.label}
                      </h4>
                      <p
                        className={`text-lg font-bold ${
                          theme === "light" ? "text-gray-900" : "text-gray-100"
                        }`}
                      >
                        {value !== null && value !== undefined
                          ? value.toFixed(4)
                          : "N/A"}
                      </p>
                      <p
                        className={`text-xs ${
                          theme === "light" ? "text-gray-600" : "text-gray-400"
                        }`}
                      >
                        {unit === "SI" ? param.siUnit : param.impUnit}
                      </p>
                    </div>
                  );
                })}
                {(results.epsilon !== undefined ||
                  results.NTU !== undefined ||
                  results.LMTD !== undefined) && (
                  <>
                    <div className="col-span-full mt-4">
                      <h3
                        className={`text-lg font-medium mb-3 ${
                          theme === "light" ? "text-gray-800" : "text-gray-200"
                        }`}
                      >
                        Performance Parameters
                      </h3>
                    </div>
                    {results.epsilon !== undefined && (
                      <div
                        className={`p-4 rounded-lg ${
                          theme === "light" ? "bg-green-50" : "bg-green-900/30"
                        }`}
                      >
                        <h4
                          className={`font-medium ${
                            theme === "light"
                              ? "text-green-800"
                              : "text-green-200"
                          }`}
                        >
                          Effectiveness (ε)
                        </h4>
                        <p
                          className={`text-lg font-bold ${
                            theme === "light"
                              ? "text-gray-900"
                              : "text-gray-100"
                          }`}
                        >
                          {results.epsilon.toFixed(4)}
                        </p>
                        <p
                          className={`text-xs ${
                            theme === "light"
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                        >
                          Dimensionless
                        </p>
                      </div>
                    )}
                    {results.NTU !== undefined && (
                      <div
                        className={`p-4 rounded-lg ${
                          theme === "light" ? "bg-green-50" : "bg-green-900/30"
                        }`}
                      >
                        <h4
                          className={`font-medium ${
                            theme === "light"
                              ? "text-green-800"
                              : "text-green-200"
                          }`}
                        >
                          Number of Transfer Units (NTU)
                        </h4>
                        <p
                          className={`text-lg font-bold ${
                            theme === "light"
                              ? "text-gray-900"
                              : "text-gray-100"
                          }`}
                        >
                          {results.NTU.toFixed(4)}
                        </p>
                        <p
                          className={`text-xs ${
                            theme === "light"
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                        >
                          Dimensionless
                        </p>
                      </div>
                    )}
                    {results.LMTD !== undefined && (
                      <div
                        className={`p-4 rounded-lg ${
                          theme === "light" ? "bg-green-50" : "bg-green-900/30"
                        }`}
                      >
                        <h4
                          className={`font-medium ${
                            theme === "light"
                              ? "text-green-800"
                              : "text-green-200"
                          }`}
                        >
                          Log Mean Temperature Difference
                        </h4>
                        <p
                          className={`text-lg font-bold ${
                            theme === "light"
                              ? "text-gray-900"
                              : "text-gray-100"
                          }`}
                        >
                          {results.LMTD.toFixed(4)}
                        </p>
                        <p
                          className={`text-xs ${
                            theme === "light"
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                        >
                          {unit === "SI" ? "°C" : "°F"} (Corrected)
                        </p>
                      </div>
                    )}
                    {results.correctionFactor !== undefined &&
                      results.correctionFactor !== 1 && (
                        <div
                          className={`p-4 rounded-lg ${
                            theme === "light"
                              ? "bg-purple-50"
                              : "bg-purple-900/30"
                          }`}
                        >
                          <h4
                            className={`font-medium ${
                              theme === "light"
                                ? "text-purple-800"
                                : "text-purple-200"
                            }`}
                          >
                            LMTD Correction Factor (F)
                          </h4>
                          <p
                            className={`text-lg font-bold ${
                              theme === "light"
                                ? "text-gray-900"
                                : "text-gray-100"
                            }`}
                          >
                            {results.correctionFactor.toFixed(4)}
                          </p>
                          <p
                            className={`text-xs ${
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
                        className={`p-4 rounded-lg ${
                          theme === "light" ? "bg-gray-50" : "bg-gray-700"
                        }`}
                      >
                        <h4
                          className={`font-medium ${
                            theme === "light"
                              ? "text-gray-800"
                              : "text-gray-200"
                          }`}
                        >
                          LMTD (Uncorrected)
                        </h4>
                        <p
                          className={`text-lg font-bold ${
                            theme === "light"
                              ? "text-gray-900"
                              : "text-gray-100"
                          }`}
                        >
                          {results.LMTD_uncorrected.toFixed(4)}
                        </p>
                        <p
                          className={`text-xs ${
                            theme === "light"
                              ? "text-gray-600"
                              : "text-gray-400"
                          }`}
                        >
                          {unit === "SI" ? "°C" : "°F"} (Pure Counter-flow)
                        </p>
                      </div>
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
                          text: `Temperature (${unit === "SI" ? "°C" : "°F"})`,
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
        <div className="mt-8 flex justify-between">
          {step > 1 && (
            <button
              onClick={handlePrevious}
              className={`px-6 py-2 rounded-lg transition ${
                theme === "light"
                  ? "bg-gray-300 text-gray-800 hover:bg-gray-400"
                  : "bg-gray-600 text-gray-200 hover:bg-gray-500"
              }`}
            >
              Previous
            </button>
          )}
          {step < 4 && (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition ml-auto"
            >
              {step === 3 ? "Calculate" : "Next"}
            </button>
          )}
          {step === 4 && (
            <button
              onClick={reset}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition ml-auto"
            >
              New Calculation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

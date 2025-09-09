import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ConductionCalculator from "./pages/index";
import HeatExchangerCalculator from "./pages/heat-exchanger";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ConductionCalculator />} />
        <Route path="/heat-exchanger" element={<HeatExchangerCalculator />} />
      </Routes>
    </Router>
  );
}

export default App;

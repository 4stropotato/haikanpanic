import Workspace from "./workspace/Workspace";           // v1.10+ modularized root workspace entry
import "./index.css";                                    // v1.10+ global styles

function App() {
  return <Workspace />;                                  // v1.10+ render centralized workspace
}

export default App;                                      // v1.10+ entry point export


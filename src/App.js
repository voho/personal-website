import React, { useEffect } from 'react';
import Hero from "./Hero";

function App() {
  useEffect(() => {
    document.title = "Vojta Hordějčuk aka voho"
  }, []);

  return (
    <Hero />
  );
}

export default App;

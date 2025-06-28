import React from 'react';
import MediaEditor from './components/MediaEditor';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <MediaEditor />
      </div>
    </ErrorBoundary>
  );
}

export default App;
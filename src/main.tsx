import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// No StrictMode: the ported component does a one-time hash/draft restore in
// componentDidMount, same call as eqlfilter.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

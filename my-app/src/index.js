import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Provider } from 'react-redux'; // 1. Импортируем провайдер
import store from './redux/redux-store';     // 2. Импортируем твой созданный store
import { BrowserRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* 3. Оборачиваем App в Provider и передаем наш store */}
    <BrowserRouter>
      <Provider store={store}>
      <App />
    </Provider>
    </BrowserRouter>
  </React.StrictMode>
);


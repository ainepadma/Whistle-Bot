import React from 'react'
import ReactDOM from 'react-dom/client'
import '../bridge/host-api'
import App from './App'
import CardApp from './CardApp'
import './styles/globals.css'
import './styles/calendar.css'

const root = document.getElementById('root')
if (!root) throw new Error('找不到 #root 元素')

const isCardMode = new URLSearchParams(window.location.search).get('mode') === 'card'

// 卡片模式：页面 body 必须透明，否则会盖住透明窗口背景
if (isCardMode) {
    document.body.classList.add('card-mode-body')
}

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        {isCardMode ? <CardApp /> : <App />}
    </React.StrictMode>
)

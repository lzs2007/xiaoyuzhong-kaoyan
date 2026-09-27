import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import SchoolTable from './components/SchoolTable.vue'
import MajorTable from './components/MajorTable.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SchoolTable', SchoolTable)
    app.component('MajorTable', MajorTable)
  }
} satisfies Theme
